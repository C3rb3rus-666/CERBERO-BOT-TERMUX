#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║   CERBERO NSFW Daemon v2.0 — Antivirus de imágenes en tiempo real          ║
║                                                                              ║
║   Arquitectura adaptativa por chipset:                                      ║
║   · Intel 12th gen (P+E cores): workers = E-cores, cv2 threads = P-cores   ║
║   · Intel 3rd gen (sin HT en E): workers = physical_cores - 1              ║
║   · ARM (Exynos/Snapdragon proot): workers = cpu_count - 1, WASM ORT       ║
║   · Genérico: workers = max(2, cpu_count // 2)                             ║
║                                                                              ║
║   Protocolo JSON-lines stdin/stdout (spawn una vez, vive toda la sesión)    ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import sys, os, json, threading, platform, glob
from concurrent.futures import ThreadPoolExecutor

# Flush inmediato — crítico para pipe con Node.js
try:
    sys.stdout.reconfigure(line_buffering=True)
except AttributeError:
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, line_buffering=True)

_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _dir)

# ─── Detección de chipset / arquitectura ─────────────────────────────────────

def _read(path):
    try:
        with open(path) as f: return f.read().strip()
    except Exception:
        return ''

def detect_cpu():
    """
    Devuelve dict con:
      arch        : 'x86_64' | 'aarch64' | 'armv7l' | ...
      family      : 'intel_hybrid' | 'intel_legacy' | 'arm' | 'generic'
      total_cpus  : int — hilos lógicos totales
      p_cores     : list[int] — CPUs P-core (Intel híbrido)
      e_cores     : list[int] — CPUs E-core (Intel híbrido) o todos en ARM
      workers     : int — número óptimo de workers para imagen-análisis
      cv2_threads : int — hilos para cv2.setNumThreads()
      model       : str — nombre del procesador
    """
    arch  = platform.machine().lower()   # x86_64, aarch64, armv7l...
    total = os.cpu_count() or 2
    model = ''

    # Leer modelo desde /proc/cpuinfo
    cpuinfo = _read('/proc/cpuinfo')
    for line in cpuinfo.splitlines():
        if 'model name' in line or 'Hardware' in line or 'Processor' in line:
            model = line.split(':', 1)[-1].strip()
            break
    if not model:
        model = platform.processor() or 'unknown'

    # ── ARM (proot Exynos, Snapdragon, etc.) ──────────────────────────────────
    if 'arm' in arch or 'aarch64' in arch:
        # En proot a veces cpu_count reporta todos los cores del host
        # Usamos max(2, total-1) para dejar 1 core libre al SO
        workers = max(2, total - 1)
        return {
            'arch': arch, 'family': 'arm', 'total_cpus': total,
            'p_cores': [], 'e_cores': list(range(total)),
            'workers': workers, 'cv2_threads': min(workers, 4),
            'model': model
        }

    # ── Intel x86_64 — analizar topología de cores ───────────────────────────
    # thread_siblings_list: si contiene '-' o ',' = hyperthreading activo = P-core
    # Solo un número = E-core (Gracemont, sin HT)
    p_cores, e_cores = [], []
    for i in range(total):
        sib = _read(f'/sys/devices/system/cpu/cpu{i}/topology/thread_siblings_list')
        if not sib:
            # Sin acceso a sysfs — asumir todos iguales
            e_cores.append(i)
        elif '-' in sib or ',' in sib:
            p_cores.append(i)
        else:
            e_cores.append(i)

    is_hybrid = len(p_cores) > 0 and len(e_cores) > 0

    if is_hybrid:
        # Intel 12th gen+: P-cores para cv2 (más IPC), E-cores para workers (más cantidad)
        workers     = max(2, len(e_cores))
        cv2_threads = max(2, len(p_cores) // 2)   # HT → div/2 evita contención
        family      = 'intel_hybrid'
    else:
        # Intel 3rd gen / genérico sin hibridación
        physical = len(set(
            _read(f'/sys/devices/system/cpu/cpu{i}/topology/core_id')
            for i in range(total)
        ) - {''}) or total
        workers     = max(2, physical - 1)   # dejar 1 core para el bot Node.js
        cv2_threads = max(1, physical // 2)
        family      = 'intel_legacy'
        e_cores     = list(range(total))

    return {
        'arch': arch, 'family': family, 'total_cpus': total,
        'p_cores': p_cores, 'e_cores': e_cores,
        'workers': workers, 'cv2_threads': cv2_threads,
        'model': model
    }

CPU = detect_cpu()

# ─── Configurar OpenCV con los hilos óptimos ─────────────────────────────────
try:
    import cv2
    cv2.setNumThreads(CPU['cv2_threads'])
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False

# ─── Configurar ONNX Runtime (Xenova/transformers usa ORT internamente en Python)
# En ARM sin AVX → forzar IntraOp a 1 para no crashear con SIGILL
# En Intel → usar todos los cv2_threads para ORT
try:
    import onnxruntime as ort
    so = ort.SessionOptions()
    so.intra_op_num_threads = CPU['cv2_threads'] if CPU['family'] != 'arm' else 1
    so.inter_op_num_threads = 1
    HAS_ORT = True
except ImportError:
    HAS_ORT = False

try:
    from scipy.ndimage import uniform_filter
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

# ─── Importar señales ─────────────────────────────────────────────────────────
from nsfw_py_signals import analyze

# ─── Pool de workers ──────────────────────────────────────────────────────────
_stdout_lock = threading.Lock()
_executor    = ThreadPoolExecutor(
    max_workers=CPU['workers'],
    thread_name_prefix='nsfw_worker'
)

def _write(obj):
    line = json.dumps(obj, ensure_ascii=False)
    with _stdout_lock:
        sys.stdout.write(line + '\n')
        sys.stdout.flush()

def _handle(req):
    req_id = req.get('id', 'x')
    fpath  = req.get('path', '')
    try:
        result = analyze(fpath)
        result['id'] = req_id
    except Exception as e:
        result = {
            'id': req_id, 'error': str(e),
            'suspect_score_contribution': 0.0, 'signals': []
        }
    _write(result)

def main():
    _write({
        'status':      'ready',
        'has_cv2':     HAS_CV2,
        'has_scipy':   HAS_SCIPY,
        'has_ort':     HAS_ORT,
        'workers':     CPU['workers'],
        'cv2_threads': CPU['cv2_threads'],
        'family':      CPU['family'],
        'arch':        CPU['arch'],
        'model':       CPU['model'],
        'p_cores':     len(CPU['p_cores']),
        'e_cores':     len(CPU['e_cores']),
        'pid':         os.getpid()
    })
    sys.stderr.write(
        f"[nsfw-daemon] ✅ {CPU['family']} | {CPU['model'][:40]} | "
        f"workers={CPU['workers']} cv2_threads={CPU['cv2_threads']} "
        f"cv2={HAS_CV2} scipy={HAS_SCIPY}\n"
    )
    sys.stderr.flush()

    for raw_line in sys.stdin:
        raw_line = raw_line.strip()
        if not raw_line: continue
        try:
            req = json.loads(raw_line)
        except json.JSONDecodeError:
            continue
        _executor.submit(_handle, req)

if __name__ == '__main__':
    main()

#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.arm"
VENV_DIR="${ROOT_DIR}/.venv"

INSTALL_PY=0
INSTALL_NODE=0

log() { printf '[ARM-SETUP] %s\n' "$*"; }
warn() { printf '[ARM-SETUP][WARN] %s\n' "$*" >&2; }
die() { printf '[ARM-SETUP][ERROR] %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Uso:
  bash scripts/arm-port-setup.sh [--install-python] [--install-node] [--full]

Opciones:
  --install-python   Instala dependencias Python en .venv (requirements + onnxruntime)
  --install-node     Ejecuta npm install y rebuild opcional de sharp/canvas
  --full             Equivale a --install-python --install-node
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-python) INSTALL_PY=1 ;;
    --install-node) INSTALL_NODE=1 ;;
    --full) INSTALL_PY=1; INSTALL_NODE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "Opcion no reconocida: $1" ;;
  esac
  shift
done

ARCH="$(uname -m 2>/dev/null || echo unknown)"
case "$ARCH" in
  aarch64|arm64|armv7l|armv8*) IS_ARM=1 ;;
  *) IS_ARM=0 ;;
esac

if [[ "$IS_ARM" -ne 1 ]]; then
  warn "Arquitectura detectada: ${ARCH}. Este script esta optimizado para ARM; continuando en modo diagnostico."
else
  log "Arquitectura ARM detectada: ${ARCH}"
fi

write_env() {
  cat > "$ENV_FILE" <<'EOF'
# CERBERO ARM profile (port hardening)
export PATH="$PWD/.venv/bin:$PATH"

# NSFW engine in ARM: hybrid mode (Xenova + python signals)
export NSFW_FORCE_XENOVA=1
export NSFW_DISABLE_XENOVA=0
export NSFW_DISABLE_NSFWJS=0
export NSFW_MAX_CONCURRENCY=1
export NSFW_MAX_QUEUE=4
export NSFW_HARD_MAX_QUEUE=120

# Gore false-positive mitigation
export GORE_SAFE_OVERRIDE_SCORE=0.90
export GORE_MODEL_CONFIRM_SCORE=0.45

# Runtime tuning
export NSFW_DEBUG=0
export NSFW_SAFE_BATCH_NOTICE_ENABLED=1
export NSFW_SAFE_BATCH_WINDOW_MS=30000

# Python/ONNX thread limits for ARM stability
export PYTHONUNBUFFERED=1
export ONNX_NUM_THREADS=1
export OMP_NUM_THREADS=1
export OPENBLAS_NUM_THREADS=1
export MKL_NUM_THREADS=1
export NUMEXPR_NUM_THREADS=1

# Node memory budget
export NODE_OPTIONS="--max-old-space-size=768 --max-semi-space-size=128"
EOF
  log "Perfil ARM escrito en ${ENV_FILE}"
}

install_python_stack() {
  log "Instalando stack Python para NSFW..."
  command -v python3 >/dev/null 2>&1 || die "python3 no esta instalado."
  cd "$ROOT_DIR"
  if [[ ! -d "$VENV_DIR" ]]; then
    python3 -m venv "$VENV_DIR"
  fi
  # shellcheck disable=SC1091
  source "$VENV_DIR/bin/activate"
  python -m pip install --upgrade pip wheel setuptools
  python -m pip install -r requirements.txt
  python -m pip install --only-binary=:all: onnxruntime || warn "onnxruntime no se pudo instalar por wheel en este entorno."
}

install_node_stack() {
  log "Instalando/ajustando stack Node para modulos nativos..."
  command -v npm >/dev/null 2>&1 || die "npm no esta instalado."
  cd "$ROOT_DIR"
  npm install --include=dev
  npm rebuild sharp --build-from-source || warn "No se pudo rebuild sharp desde fuente."
  npm rebuild canvas --build-from-source || warn "No se pudo rebuild canvas desde fuente."
}

verify_python_stack() {
  local pybin="python3"
  if [[ -x "$VENV_DIR/bin/python" ]]; then
    pybin="$VENV_DIR/bin/python"
  fi

  log "Verificando stack Python (NSFW)..."
  "$pybin" - <<'PY'
mods = ['PIL', 'numpy', 'scipy', 'cv2', 'onnxruntime']
missing = []
for m in mods:
    try:
        __import__(m)
        print(f'[PY-OK] {m}')
    except Exception as e:
        missing.append((m, str(e)))
        print(f'[PY-MISS] {m}: {str(e)[:140]}')

if missing:
    print('\n[PY] Faltan modulos para precision máxima de anti-NSFW.')
PY
}

verify_node_stack() {
  log "Verificando imports Node (sharp/canvas/sticker/nsfw)..."
  cd "$ROOT_DIR"
  node - <<'NODE'
const checks = [
  'sharp',
  'canvas',
  './comandos_cerbero/sticker.js',
  './comandos_cerbero/owner_guard.js',
  './comandos_cerbero/bateria_defensa.js',
];

const run = async () => {
  let fails = 0;
  for (const c of checks) {
    try {
      await import(c);
      console.log(`[NODE-OK] ${c}`);
    } catch (e) {
      fails++;
      console.log(`[NODE-FAIL] ${c}: ${(e && e.message) ? e.message : e}`);
    }
  }
  if (fails > 0) process.exit(1);
};

run();
NODE

  node --check index.js
  node --check comandos_cerbero/sticker.js
  node --check comandos_cerbero/nsfw_classifier.js
  node --check comandos_cerbero/nsfw_detector.js
  node --check comandos_cerbero/index.js
  log "Verificacion Node completada."
}

write_env

if [[ "$INSTALL_PY" -eq 1 ]]; then install_python_stack; fi
if [[ "$INSTALL_NODE" -eq 1 ]]; then install_node_stack; fi

verify_python_stack
verify_node_stack

if [[ -f "$ROOT_DIR/scripts/verify-arm-canvas.js" ]]; then
  log "Ejecutando verificacion adicional de canvas..."
  (cd "$ROOT_DIR" && node scripts/verify-arm-canvas.js) || warn "verify-arm-canvas reporto problemas."
fi

log "Listo. Activa perfil con: source .env.arm"
log "Luego inicia el bot con: npm start"

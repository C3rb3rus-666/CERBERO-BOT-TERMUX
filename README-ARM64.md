# CERBERO-BOT Termux — Guía de Inicio ARM64

## 📱 Configuración para ARM64/Termux

Este bot está portado y optimizado para ejecutarse en **ARM64** (Termux, distros Linux ARM, etc.) con enfoque en anti-NSFW mejorado.

---

## 🚀 Inicio Rápido (Automatizado)

### Opción 1: Script de inicio con variables ARM64 (RECOMENDADO)

```bash
cd /home/carlos/Documentos/CERBERO-BOT-TERMUX
chmod +x start-arm64.sh
./start-arm64.sh
```

Este script:
- ✅ Detecta automáticamente ARM64
- ✅ Configura variables de entorno optimizadas para ARM
- ✅ Ejecuta `npm start`
- ✅ Registra el inicio en `start-arm64.log`

---

### Opción 2: Configuración manual con .env

1. Copiar `.env.arm64` a `.env`:
```bash
cp .env.arm64 .env
```

2. Luego instalar y ejecutar:
```bash
npm ci
npm start
```

---

### Opción 3: Variables inline (One-liner)

```bash
NSFW_MAX_CONCURRENCY=1 PRESENTACIONES_ARM_SAFE_MODE=1 PRESENTACIONES_CLIP=0 npm start
```

---

## ⚙️ Variables ARM64 Explicadas

### Anti-NSFW (nsfw_detector.js)
```bash
NSFW_MAX_CONCURRENCY=1              # 1 imagen simultánea (ARM es single-core en recursos)
NSFW_MAX_QUEUE=4                    # Máx 4 imágenes en cola
NSFW_DETECTION_TIMEOUT_MS=45000     # 45s timeout para análisis
```

**Impacto**: Evita saturar ARM con análisis de imágenes. Procesa una por una sin bloqueos.

---

### Presentaciones/Tinder (presentaciones.js)
```bash
PRESENTACIONES_ARM_SAFE_MODE=1       # Modo seguro (desactiva sharp/CLIP)
PRESENTACIONES_FORCE_NATIVE=0        # No fuerza análisis nativo en ARM
PRESENTACIONES_CLIP=0                # Desactiva CLIP (muy pesado en ARM)
PRESENTACIONES_MAX_IMAGE_BYTES=6MB   # 6MB máx (vs 14MB en x86)
PRESENTACIONES_MAX_PENDING=2         # 2 imágenes máx en la cola
```

**Impacto**: Presentaciones funciona con análisis heurístico (sin modelos IA locales), compatible con ARM.

---

### Modelos ONNX & Threading
```bash
ONNX_NUM_THREADS=1                   # 1 thread para ONNX Runtime
OMP_NUM_THREADS=1                    # 1 thread OpenMP
MKL_NUM_THREADS=1                    # 1 thread Intel MKL
```

**Impacto**: Evita context-switching en ARM, reduce overhead de threading.

---

### Memoria Node.js
```bash
NODE_OPTIONS="--max-old-space-size=512 --max-semi-space-size=64"
```

**Impacto**: Limita Node a 512MB (usual en Termux), evita OOM.

---

## ✅ Verificar Inicio

Después de ejecutar, verifica que el bot esté online:

```bash
# En otra terminal
tail -f start-arm64.log
```

Deberías ver líneas como:
```
✅ Bot conectado
🟢 Sesión activa
[NSFW] ARM64 concurrency=1, queue=4
```

---

## 🐍 nsfw_daemon.py en ARM64

Si usas `nsfw_daemon.py` (Python ONNX runtime):

1. **Verificar Python**:
```bash
python3 --version
python3 -c "import platform; print(platform.machine())"
```

2. **El daemon detecta ARM automáticamente**:
   - Reduce workers a `(cpu_count - 1)`
   - Configura ONNX Runtime para ARM
   - Usa WASM si es necesario

No requiere configuración adicional — funciona automáticamente.

---

## 🔧 Troubleshooting

### Problema: Anti-NSFW lento o no responde
**Solución**: Reduce `NSFW_MAX_QUEUE` o aumenta `NSFW_DETECTION_TIMEOUT_MS`:
```bash
export NSFW_MAX_QUEUE=2
export NSFW_DETECTION_TIMEOUT_MS=60000
```

### Problema: Presentaciones/Tinder falla
**Solución**: Asegurate de estar en modo seguro:
```bash
export PRESENTACIONES_ARM_SAFE_MODE=1
export PRESENTACIONES_CLIP=0
```

### Problema: Bot consume mucha RAM
**Solución**: Limita más la memoria:
```bash
export NODE_OPTIONS="--max-old-space-size=256"
npm start
```

---

## 📊 Monitoreo

Ver recursos en tiempo real (Termux):
```bash
top -p $(pgrep -f "node index.js")
```

Ver logs:
```bash
tail -100f start-arm64.log
```

---

## 🔄 Reinicio Automático (Opcional)

Crear cron job en Termux para reiniciar si falla:

```bash
# Editar crontab
crontab -e

# Añadir línea (reinicia cada 6 horas)
0 */6 * * * cd /home/carlos/Documentos/CERBERO-BOT-TERMUX && ./start-arm64.sh >> start-cron.log 2>&1
```

---

## 📝 Notas

- ✅ Anti-NSFW está optimizado para 1 imagen simultánea
- ✅ Presentaciones usa análisis heurístico (compatible ARM)
- ✅ CLIP/Sharp desactivados por defecto en ARM (configurable)
- ✅ nsfw_daemon.py detecta ARM automáticamente
- ✅ Variables de entorno pueden editarse en `.env.arm64` o pasarse inline

---

## 🚀 Próximos Pasos

1. `chmod +x start-arm64.sh` (hacer script ejecutable)
2. `./start-arm64.sh` (iniciar)
3. Verificar logs en `start-arm64.log`
4. ¡Disfrutar CERBERO-BOT en ARM64! 🎉

---

**Build**: 97  
**Versión**: v4.4.19-TERMUX  
**Última actualización**: 2026-07-19

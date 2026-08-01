#!/bin/bash
# ============================================================================
# start-arm64.sh — Script de inicio automatizado para CERBERO-BOT en ARM64
# ============================================================================
# Configura automáticamente variables de entorno ARM64 y ejecuta el bot
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Detectar arquitectura
ARCH=$(uname -m)
IS_ARM=0
[[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" || "$ARCH" == "armv7l" ]] && IS_ARM=1

if [[ $IS_ARM -eq 1 ]]; then
  echo "🔧 Configurando CERBERO-BOT para ARM64..."
  
  # Optimización de concurrencia para ARM
  export NSFW_FORCE_XENOVA=1
  export NSFW_DISABLE_XENOVA=0
  export NSFW_MAX_CONCURRENCY=1
  export NSFW_MAX_QUEUE=4
  export NSFW_DETECTION_TIMEOUT_MS=45000
  
  # Modo seguro para presentaciones/tinder en ARM
  export PRESENTACIONES_ARM_SAFE_MODE=1
  export PRESENTACIONES_FORCE_NATIVE=0
  export PRESENTACIONES_CLIP=0
  export PRESENTACIONES_MAX_IMAGE_BYTES=$((6 * 1024 * 1024))
  export PRESENTACIONES_MAX_PENDING=2
  export PRESENTACIONES_NSFW_TIMEOUT_MS=60000
  export PRESENTACIONES_CLIP_TIMEOUT_MS=45000
  export PRESENTACIONES_GROUP_SEND_DELAY_MS=1200
  
  # Threads para modelos ONNX/ML en ARM
  export ONNX_NUM_THREADS=1
  export OMP_NUM_THREADS=1
  export MKL_NUM_THREADS=1
  
  # Limitar memoria Node.js en ARM
  export NODE_OPTIONS="--max-old-space-size=512 --max-semi-space-size=64"
  
  echo "✅ Variables ARM64 configuradas"
else
  echo "⚠️  No se detectó ARM64. Iniciando con configuración estándar..."
fi

echo ""
echo "📱 Iniciando CERBERO-BOT..."
echo "================================="
echo ""

# Capturar PID para logging
PID=$$
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Iniciando bot (PID: $PID)" >> start-arm64.log 2>&1

# Ejecutar el bot con npm start
exec npm start

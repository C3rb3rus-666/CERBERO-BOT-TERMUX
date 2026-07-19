#!/bin/bash
# ============================================================================
# setup-arm64.sh — Configuración automatizada para CERBERO-BOT en ARM64/Termux
# ============================================================================
# Detecta ARM64 y configura variables de entorno para optimizar:
# - Anti-NSFW con límites de concurrencia
# - Presentaciones/Tinder en modo seguro
# - Timeouts adaptados a hardware limitado
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔧 CERBERO-BOT Configuración ARM64"
echo "================================="
echo ""

# ─── Detección de arquitectura ───
ARCH=$(uname -m)
echo "📋 Arquitectura detectada: $ARCH"

if [[ "$ARCH" != "aarch64" && "$ARCH" != "arm64" && "$ARCH" != "armv7l" ]]; then
  echo "⚠️  No se detectó ARM. Procede con configuración estándar."
  IS_ARM=0
else
  echo "✅ ARM64 detectado"
  IS_ARM=1
fi

# ─── Detección de Termux ───
if [[ -d "$PREFIX" || "$TERMUX_APP_PID" != "" ]]; then
  echo "✅ Termux detectado"
  IS_TERMUX=1
else
  echo "📌 Termux no detectado (posible instalación en distro Linux)"
  IS_TERMUX=0
fi

echo ""
echo "📝 Variables de entorno para ARM64:"
echo "===================================="

# ─── Exportar variables para nsfw_detector.js (ARM64) ───
export NSFW_MAX_CONCURRENCY=1
export NSFW_MAX_QUEUE=4
export NSFW_DETECTION_TIMEOUT_MS=45000

echo "  NSFW_MAX_CONCURRENCY=1          (1 imagen simultanea en ARM)"
echo "  NSFW_MAX_QUEUE=4                (cola max 4 imágenes)"
echo "  NSFW_DETECTION_TIMEOUT_MS=45000 (45s timeout para análisis)"

# ─── Exportar variables para presentaciones.js (ARM64) ───
export PRESENTACIONES_ARM_SAFE_MODE=1
export PRESENTACIONES_FORCE_NATIVE=0
export PRESENTACIONES_CLIP=0
export PRESENTACIONES_MAX_IMAGE_BYTES=$((6 * 1024 * 1024))
export PRESENTACIONES_MAX_PENDING=2
export PRESENTACIONES_NSFW_TIMEOUT_MS=60000
export PRESENTACIONES_CLIP_TIMEOUT_MS=45000
export PRESENTACIONES_GROUP_SEND_DELAY_MS=1200

echo "  PRESENTACIONES_ARM_SAFE_MODE=1"
echo "  PRESENTACIONES_FORCE_NATIVE=0   (desactiva sharp/CLIP)"
echo "  PRESENTACIONES_CLIP=0           (desactiva CLIP en presentaciones)"
echo "  PRESENTACIONES_MAX_IMAGE_BYTES=6MB"
echo "  PRESENTACIONES_MAX_PENDING=2"
echo "  PRESENTACIONES_NSFW_TIMEOUT_MS=60000"
echo "  PRESENTACIONES_CLIP_TIMEOUT_MS=45000"
echo "  PRESENTACIONES_GROUP_SEND_DELAY_MS=1200 (delay entre envios en grupos)"

# ─── Configuración Python para ARM64 ───
export ONNX_NUM_THREADS=1
export OMP_NUM_THREADS=1
export MKL_NUM_THREADS=1

echo "  ONNX_NUM_THREADS=1  (1 thread para modelos ONNX)"
echo "  OMP_NUM_THREADS=1   (1 thread OpenMP)"
echo "  MKL_NUM_THREADS=1   (1 thread MKL)"

# ─── Variables de Node.js ───
export NODE_OPTIONS="--max-old-space-size=512 --max-semi-space-size=64"

echo "  NODE_OPTIONS=--max-old-space-size=512 (limitar memoria Node)"

echo ""
echo "✅ Configuración ARM64 lista"
echo ""
echo "🚀 Próximos pasos:"
echo "   1. npm ci (instalar dependencias)"
echo "   2. npm start (ejecutar bot)"
echo ""
echo "💾 Para cargar automáticamente esta config, usa:"
echo "   source setup-arm64.sh && npm ci && npm start"
echo ""

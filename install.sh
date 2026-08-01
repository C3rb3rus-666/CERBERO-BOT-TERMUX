#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_PREFIX="[CERBERO-INSTALL]"
SKIP_SYSTEM=0
START_AFTER=0

log() { printf '%s %s\n' "$LOG_PREFIX" "$*"; }
warn() { printf '%s [WARN] %s\n' "$LOG_PREFIX" "$*" >&2; }
die() { printf '%s [ERROR] %s\n' "$LOG_PREFIX" "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

usage() {
  cat <<'EOF'
Uso:
  bash install.sh [--skip-system] [--start]

Opciones:
  --skip-system  Omite instalacion de paquetes del sistema
  --start        Inicia el bot al final cargando .env.arm
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-system) SKIP_SYSTEM=1 ;;
    --start) START_AFTER=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "Opcion no reconocida: $1" ;;
  esac
  shift
done

run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif have sudo; then
    sudo "$@"
  elif have doas; then
    doas "$@"
  else
    die "No hay permisos root para ejecutar: $*"
  fi
}

detect_pm() {
  if have apt-get; then echo apt; return; fi
  if have pacman; then echo pacman; return; fi
  if have apk; then echo apk; return; fi
  if have dnf; then echo dnf; return; fi
  if have yum; then echo yum; return; fi
  if have zypper; then echo zypper; return; fi
  echo none
}

install_system_packages() {
  local pm="$1"
  log "Instalando dependencias del sistema con ${pm}..."
  case "$pm" in
    apt)
      run_as_root apt-get update
      run_as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y \
        bash ca-certificates curl git make g++ gcc pkg-config python3 python3-venv python3-pip \
        ffmpeg libjpeg-dev libpng-dev libgif-dev librsvg2-dev libcairo2-dev libpango1.0-dev \
        libvips-dev libwebp-dev libopencv-dev
      ;;
    pacman)
      run_as_root pacman -Syu --needed --noconfirm \
        bash ca-certificates curl git base-devel python python-pip python-virtualenv \
        ffmpeg libjpeg-turbo libpng giflib librsvg cairo pango vips opencv
      ;;
    apk)
      run_as_root apk update
      run_as_root apk add --no-cache \
        bash ca-certificates curl git build-base pkgconf python3 py3-pip python3-dev \
        ffmpeg jpeg-dev libpng-dev giflib-dev librsvg-dev cairo-dev pango-dev vips-dev opencv-dev
      ;;
    dnf)
      run_as_root dnf install -y \
        bash ca-certificates curl git make gcc gcc-c++ pkgconf-pkg-config python3 python3-pip \
        ffmpeg libjpeg-turbo-devel libpng-devel giflib-devel librsvg2-devel cairo-devel \
        pango-devel vips-devel opencv-devel
      ;;
    yum)
      run_as_root yum install -y \
        bash ca-certificates curl git make gcc gcc-c++ pkgconfig python3 python3-pip \
        ffmpeg libjpeg-turbo-devel libpng-devel giflib-devel librsvg2-devel cairo-devel \
        pango-devel vips-devel opencv-devel
      ;;
    zypper)
      run_as_root zypper --non-interactive install \
        bash ca-certificates curl git make gcc gcc-c++ pkg-config python3 python3-pip \
        ffmpeg libjpeg-devel libpng16-devel giflib-devel librsvg-devel cairo-devel \
        pango-devel vips-devel opencv-devel
      ;;
    *)
      warn "No se detecto gestor soportado; continuo sin instalar paquetes del sistema."
      ;;
  esac
}

main() {
  cd "$ROOT_DIR"
  [[ -f package.json ]] || die "No se encontro package.json en ${ROOT_DIR}"
  [[ -f scripts/arm-port-setup.sh ]] || die "No se encontro scripts/arm-port-setup.sh"

  local pm="none"
  if [[ "$SKIP_SYSTEM" -eq 0 ]]; then
    pm="$(detect_pm)"
    install_system_packages "$pm"
  else
    log "Saltando paquetes del sistema por --skip-system"
  fi

  have npm || die "npm no esta instalado."
  log "Instalando dependencias Node..."
  npm install --include=dev

  log "Ejecutando setup ARM completo..."
  bash scripts/arm-port-setup.sh --full

  log "Instalacion completada."
  log "Siguiente paso: source .env.arm && npm start"

  if [[ "$START_AFTER" -eq 1 ]]; then
    log "Iniciando bot con entorno .env.arm..."
    # shellcheck disable=SC1091
    source .env.arm
    npm start
  fi
}

main "$@"

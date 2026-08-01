#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_PREFIX="[CERBERO-INSTALL]"
SKIP_SYSTEM=0
START_AFTER=0

log()  { printf '%s %s\n'        "$LOG_PREFIX" "$*"; }
warn() { printf '%s [WARN] %s\n' "$LOG_PREFIX" "$*" >&2; }
die()  { printf '%s [ERROR] %s\n' "$LOG_PREFIX" "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

usage() {
  cat <<'EOF'
Uso:
  bash install.sh [--skip-system] [--start]

Opciones:
  --skip-system  Omite instalacion de paquetes del sistema
  --start        Inicia el bot al final cargando .env.arm

Distros soportadas:
  Termux nativo (pkg), Debian/Ubuntu/proot (apt), Arch/Manjaro (pacman),
  Alpine (apk), Fedora/RHEL (dnf), CentOS (yum), openSUSE (zypper),
  Void Linux (xbps-install), OpenWRT (opkg)
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

# Detectar si es Termux nativo (sin proot)
is_termux() {
  [[ -n "${TERMUX_VERSION:-}" ]] || [[ "${PREFIX:-}" == *termux* ]]
}

run_as_root() {
  if is_termux; then
    # En Termux nativo no hay sudo ni root; ejecutar directo
    "$@"
  elif [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif have sudo; then
    sudo "$@"
  elif have doas; then
    doas "$@"
  else
    warn "Sin permisos root para: $*  — intenta como root o instala sudo."
  fi
}

detect_pm() {
  # Termux nativo tiene su propio gestor
  if is_termux && have pkg; then echo termux; return; fi
  if have apt-get;       then echo apt;     return; fi
  if have pacman;        then echo pacman;  return; fi
  if have apk;           then echo apk;     return; fi
  if have dnf;           then echo dnf;     return; fi
  if have yum;           then echo yum;     return; fi
  if have zypper;        then echo zypper;  return; fi
  if have xbps-install;  then echo xbps;    return; fi
  if have opkg;          then echo opkg;    return; fi
  echo none
}

ensure_sharp_prereqs() {
  local pm="$1"
  case "$pm" in
    apt)
      # En Debian/Ubuntu proot, sharp/vips necesita estas cabeceras para rebuild.
      run_as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y \
        libglib2.0-dev libvips-dev libwebp-dev libcairo2-dev libpango1.0-dev \
        libjpeg-dev libpng-dev libgif-dev librsvg2-dev >/dev/null 2>&1 \
        || warn "No se pudieron instalar todas las cabeceras sharp; el instalador siguio con el mejor esfuerzo."
      ;;
    termux)
      pkg install -y glib vips webp cairo pango jpeg-turbo libpng giflib librsvg >/dev/null 2>&1 \
        || warn "No se pudieron instalar todas las dependencias sharp en Termux; el instalador siguio con el mejor esfuerzo."
      ;;
    apk)
      run_as_root apk add --no-cache glib-dev vips-dev webp-dev cairo-dev pango-dev jpeg-dev libpng-dev giflib-dev librsvg-dev >/dev/null 2>&1 \
        || warn "No se pudieron instalar todas las dependencias sharp en Alpine; el instalador siguio con el mejor esfuerzo."
      ;;
    dnf|yum|zypper|xbps)
      # Ya se cubren en install_system_packages; esto solo fuerza la presencia de cabeceras clave.
      :
      ;;
  esac
}

install_system_packages() {
  local pm="$1"
  log "Gestor detectado: ${pm} — instalando dependencias del sistema..."
  case "$pm" in
    termux)
      # Termux nativo (Android/ARM sin proot)
      pkg update -y
      pkg install -y \
        python ffmpeg libjpeg-turbo libpng libgif librsvg cairo pango \
        libvips libwebp opencv make clang pkg-config binutils git curl
      # pip en Termux
      pip install --upgrade pip setuptools wheel 2>/dev/null || true
      ;;
    apt)
      run_as_root apt-get update
      run_as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y \
        bash ca-certificates curl git make g++ gcc pkg-config \
        python3 python3-venv python3-pip \
        ffmpeg libjpeg-dev libpng-dev libgif-dev librsvg2-dev \
        libcairo2-dev libpango1.0-dev libglib2.0-dev \
        libvips-dev libwebp-dev libopencv-dev
      ;;
    pacman)
      run_as_root pacman -Syu --needed --noconfirm \
        bash ca-certificates curl git base-devel \
        python python-pip python-virtualenv \
        ffmpeg libjpeg-turbo libpng giflib librsvg \
        cairo pango vips opencv
      ;;
    apk)
      run_as_root apk update
      run_as_root apk add --no-cache \
        bash ca-certificates curl git build-base pkgconf \
        python3 py3-pip python3-dev \
        ffmpeg jpeg-dev libpng-dev giflib-dev librsvg-dev \
        cairo-dev pango-dev vips-dev opencv-dev glib-dev
      ;;
    dnf)
      run_as_root dnf install -y \
        bash ca-certificates curl git make gcc gcc-c++ pkgconf-pkg-config \
        python3 python3-pip \
        ffmpeg libjpeg-turbo-devel libpng-devel giflib-devel librsvg2-devel \
        cairo-devel pango-devel vips-devel opencv-devel glib2-devel
      ;;
    yum)
      run_as_root yum install -y \
        bash ca-certificates curl git make gcc gcc-c++ pkgconfig \
        python3 python3-pip \
        ffmpeg libjpeg-turbo-devel libpng-devel giflib-devel librsvg2-devel \
        cairo-devel pango-devel vips-devel opencv-devel glib2-devel
      ;;
    zypper)
      run_as_root zypper --non-interactive install \
        bash ca-certificates curl git make gcc gcc-c++ pkg-config \
        python3 python3-pip \
        ffmpeg libjpeg-devel libpng16-devel giflib-devel librsvg-devel \
        cairo-devel pango-devel vips-devel opencv-devel glib2-devel
      ;;
    xbps)
      # Void Linux
      run_as_root xbps-install -Syu
      run_as_root xbps-install -y \
        bash ca-certificates curl git make gcc pkg-config \
        python3 python3-pip \
        ffmpeg libjpeg-turbo-devel libpng-devel giflib-devel librsvg-devel \
        cairo-devel pango-devel vips-devel opencv-devel glib-devel
      ;;
    opkg)
      # OpenWRT
      opkg update
      opkg install bash curl git make gcc python3 python3-pip ffmpeg || true
      warn "OpenWRT: paquetes de desarrollo limitados; algunos modulos nativos pueden no compilar."
      ;;
    *)
      warn "Gestor no soportado. Instala manualmente: python3 ffmpeg libvips-dev libcairo2-dev libpango1.0-dev libglib2.0-dev"
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
    ensure_sharp_prereqs "$pm"
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

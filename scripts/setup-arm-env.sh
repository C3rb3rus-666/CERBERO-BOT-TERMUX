#!/usr/bin/env bash
set -Eeuo pipefail

BOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${BOT_DIR}/.venv"
ENV_FILE="${BOT_DIR}/.env.arm"
LOG_PREFIX="[CERBERO-ARM]"

say() { printf '%s %s\n' "$LOG_PREFIX" "$*"; }
warn() { printf '%s WARN: %s\n' "$LOG_PREFIX" "$*" >&2; }
die() { printf '%s ERROR: %s\n' "$LOG_PREFIX" "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

run_as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif have sudo; then
    sudo "$@"
  elif have doas; then
    doas "$@"
  else
    die "Necesito permisos root para: $*. Ejecuta este script como root o instala sudo/doas."
  fi
}

detect_pm() {
  if have apt-get; then echo apt; return; fi
  if have pacman; then echo pacman; return; fi
  if have apk; then echo apk; return; fi
  if have dnf; then echo dnf; return; fi
  if have yum; then echo yum; return; fi
  if have zypper; then echo zypper; return; fi
  die "No encontre gestor soportado: apt, pacman, apk, dnf, yum o zypper."
}

install_system_packages() {
  local pm="$1"
  say "Instalando toolchain y librerias nativas para canvas/sharp/ffmpeg con ${pm}..."

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
      python3 -m venv --help >/dev/null 2>&1 || run_as_root apk add --no-cache py3-virtualenv
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
  esac
}

ensure_node() {
  local major=""
  if have node; then
    major="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || true)"
  fi

  if [ -n "$major" ] && [ "$major" -ge 20 ] && have npm; then
    say "Node.js $(node -v) detectado."
    return
  fi

  say "Node.js 20+ no esta listo. Intentando instalarlo..."
  local pm="$1"
  case "$pm" in
    apt)
      if have curl; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | run_as_root bash -
      fi
      run_as_root apt-get install -y nodejs
      ;;
    pacman) run_as_root pacman -S --needed --noconfirm nodejs npm ;;
    apk) run_as_root apk add --no-cache nodejs npm ;;
    dnf) run_as_root dnf install -y nodejs npm ;;
    yum) run_as_root yum install -y nodejs npm ;;
    zypper) run_as_root zypper --non-interactive install nodejs20 npm20 || run_as_root zypper --non-interactive install nodejs npm ;;
  esac

  have node || die "Node.js no quedo instalado."
  have npm || die "npm no quedo instalado."
  say "Node.js $(node -v) listo."
}

setup_python_env() {
  say "Preparando venv Python en ${VENV_DIR}..."
  cd "$BOT_DIR"
  python3 -m venv "$VENV_DIR"
  . "${VENV_DIR}/bin/activate"
  python -m pip install --upgrade pip setuptools wheel
  python -m pip install --upgrade \
    yt-dlp colorama pillow numpy scipy opencv-python-headless
  python -m pip install --upgrade onnxruntime || warn "onnxruntime no se pudo instalar en esta arquitectura; el daemon seguira usando OpenCV/Numpy/Scipy."
  python - <<'PY'
import importlib
mods = ["colorama", "PIL", "numpy", "scipy", "cv2"]
for mod in mods:
    importlib.import_module(mod)
print("python_nsfw_stack_ok")
PY
}

test_python_daemon() {
  if [ ! -f "${BOT_DIR}/comandos_cerbero/nsfw_daemon.py" ]; then
    return
  fi

  say "Probando daemon Python anti-NSFW..."
  cd "$BOT_DIR"
  . "${VENV_DIR}/bin/activate"
  timeout 12s python comandos_cerbero/nsfw_daemon.py >/tmp/cerbero_nsfw_daemon_test.out 2>/tmp/cerbero_nsfw_daemon_test.err <<<'{"id":"setup_probe","path":"/dev/null"}' || true
  if grep -q '"status": "ready"\|"status":"ready"' /tmp/cerbero_nsfw_daemon_test.out; then
    say "Daemon Python listo para activarse con NSFW_ENABLE_PY_DAEMON=1."
  else
    warn "El daemon Python no confirmo ready durante la prueba. Revisa /tmp/cerbero_nsfw_daemon_test.err si falla al arrancar el bot."
  fi
}

verify_canvas() {
  say "Verificando canvas nativo..."
  cd "$BOT_DIR"
  node scripts/verify-arm-canvas.js
}

verify_node_imports() {
  say "Verificando imports criticos del bot..."
  cd "$BOT_DIR"
  node --input-type=module -e "await import('./comandos_cerbero/confesiones.js'); console.log('confesiones_import_ok')"
  node --input-type=module -e "await import('./comandos_cerbero/blackjack_cards.js'); console.log('blackjack_import_ok')"
}

setup_node_env() {
  say "Instalando dependencias Node para la arquitectura actual..."
  cd "$BOT_DIR"
  if [ -f package-lock.json ]; then
    npm_config_build_from_source=true npm ci
  else
    npm_config_build_from_source=true npm install
  fi
  npm_config_build_from_source=true npm rebuild canvas --build-from-source
  npm rebuild sharp --build-from-source || warn "sharp no se pudo reconstruir desde fuente; se usara el paquete instalado por npm si funciona."
  verify_canvas
  verify_node_imports
  node --check index.js
  node --check comandos_cerbero/confesiones.js
  node --check comandos_cerbero/blackjack_cards.js
  [ -f comandos_cerbero/nsfw_classifier.js ] && node --check comandos_cerbero/nsfw_classifier.js
  [ -f comandos_cerbero/nsfw_detector.js ] && node --check comandos_cerbero/nsfw_detector.js
}

write_arm_env() {
  say "Escribiendo perfil ARM en ${ENV_FILE}..."
  cat > "$ENV_FILE" <<'EOF'
# CERBERO-BOT ARM/proot profile
# Cargalo con: source .env.arm
export PATH="$PWD/.venv/bin:$HOME/.local/bin:$PATH"

export NSFW_ENABLE_PY_DAEMON=1
export NSFW_FORCE_NATIVE_IMAGE=1
export NSFW_FORCE_NSFWJS=1
export NSFW_DISABLE_XENOVA=1
export NSFW_MAX_CONCURRENCY=1
export NSFW_MAX_QUEUE=4
export PYTHONUNBUFFERED=1
export OMP_NUM_THREADS=1
export OPENBLAS_NUM_THREADS=1
export MKL_NUM_THREADS=1
export NUMEXPR_NUM_THREADS=1
EOF
}

print_next_steps() {
  local start_cmd="npm start"
  if [ -f "${BOT_DIR}/kerbero2.py" ]; then
    start_cmd="python3 kerbero2.py"
  fi

  cat <<EOF

${LOG_PREFIX} Entorno ARM preparado y canvas verificado.

Para iniciar:

  cd "$BOT_DIR"
  source .env.arm
  ${start_cmd}

EOF
}

main() {
  cd "$BOT_DIR"
  local pm
  pm="$(detect_pm)"
  say "Directorio del bot: ${BOT_DIR}"
  say "Arquitectura detectada: $(uname -m)"
  install_system_packages "$pm"
  ensure_node "$pm"
  setup_python_env
  test_python_daemon
  setup_node_env
  write_arm_env
  print_next_steps
}

main "$@"

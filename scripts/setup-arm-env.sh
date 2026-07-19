#!/usr/bin/env bash
set -Eeuo pipefail

BOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${BOT_DIR}/.venv"
ENV_FILE="${BOT_DIR}/.env.arm"
LOG_PREFIX="[CERBERO-ARM]"

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  BLUE="$(printf '\033[38;5;39m')"
  BLUE_DARK="$(printf '\033[38;5;27m')"
  RED="$(printf '\033[38;5;196m')"
  DIM="$(printf '\033[2m')"
  BOLD="$(printf '\033[1m')"
  RESET="$(printf '\033[0m')"
else
  BLUE=""; BLUE_DARK=""; RED=""; DIM=""; BOLD=""; RESET=""
fi

STEP=0

say() { printf '%s%s%s %s\n' "$BLUE" "$LOG_PREFIX" "$RESET" "$*"; }
ok() { printf '%s%s%s %s\n' "$BLUE" "[OK]" "$RESET" "$*"; }
warn() { printf '%s%s%s %s\n' "$RED" "[WARN]" "$RESET" "$*" >&2; }
die() { printf '%s%s%s %s\n' "$RED" "[ERROR]" "$RESET" "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

section() {
  STEP=$((STEP + 1))
  printf '\n%s%s[%02d]%s %s%s%s\n' "$RED" "$BOLD" "$STEP" "$RESET" "$BLUE" "$*" "$RESET"
  printf '%s%s%s\n' "$DIM" "────────────────────────────────────────────────────────────" "$RESET"
}

banner() {
  cat <<EOF
${BLUE_DARK}${BOLD}
   ______ __________  ____  __________  ____     ___    ____  __  ___
  / ____// ____/ __ \/ __ )/ ____/ __ \/ __ \   /   |  / __ \/  |/  /
 / /    / __/ / /_/ / __  / __/ / /_/ / / / /  / /| | / /_/ / /|_/ /
/ /___ / /___/ _, _/ /_/ / /___/ _, _/ /_/ /  / ___ |/ _, _/ /  / /
\____//_____/_/ |_/_____/_____/_/ |_|\____/  /_/  |_/_/ |_/_/  /_/
${RESET}${RED}${BOLD}                 ARM / PROOT DISTRO INSTALLER${RESET}
${DIM}                 canvas nativo, Python NSFW, ffmpeg y runtime Node${RESET}
EOF
}

finish_ok() {
  printf '\n%s%sCERBERO ARM listo.%s %sEl entorno quedo preparado y verificado.%s\n' "$BLUE" "$BOLD" "$RESET" "$DIM" "$RESET"
}

usage() {
  banner
  cat <<EOF

${BLUE}${BOLD}Uso${RESET}
  bash scripts/setup-arm-env.sh
  npm run setup:arm

${BLUE}${BOLD}Que prepara${RESET}
  ${RED}-${RESET} Librerias nativas para canvas: Cairo, Pango, JPEG, PNG, GIF, librsvg
  ${RED}-${RESET} ffmpeg, compiladores, pkg-config y toolchain ARM
  ${RED}-${RESET} Node.js 20+, node-gyp local y rebuild de canvas desde fuente
  ${RED}-${RESET} Python venv, ONNX Runtime por wheel ARM64 y perfil .env.arm
  ${RED}-${RESET} Verificacion real de canvas.node, confesiones y blackjack

${DIM}Tip: si quieres salida sin colores, ejecuta NO_COLOR=1 npm run setup:arm${RESET}
EOF
}

trap 'printf "\n%s%sInstalacion interrumpida o fallida.%s Revisa el ultimo bloque rojo de error.\n" "$RED" "$BOLD" "$RESET" >&2' ERR

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
  section "Toolchain nativo (${pm})"
  say "Instalando Cairo/Pango, codecs de imagen, compiladores y ffmpeg..."

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
  ok "Paquetes del sistema listos para compilar canvas en ARM."
}

ensure_node() {
  section "Runtime Node.js"
  local major=""
  if have node; then
    major="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || true)"
  fi

  if [ -n "$major" ] && [ "$major" -ge 20 ] && have npm; then
    ok "Node.js $(node -v) detectado."
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
  ok "Node.js $(node -v) listo."
}

setup_python_env() {
  section "Python NSFW stack"
  say "Preparando venv Python en ${VENV_DIR}..."
  cd "$BOT_DIR"
  python3 -m venv "$VENV_DIR"
  . "${VENV_DIR}/bin/activate"
  python -m pip install --upgrade pip setuptools wheel
  python -m pip install --upgrade \
    yt-dlp colorama pillow numpy scipy opencv-python-headless
  say "Instalando onnxruntime solo desde wheel binario ARM64..."
  python -m pip install --upgrade --only-binary=:all: onnxruntime \
    || die "onnxruntime no tiene wheel compatible para este Python/ARM64. Usa Debian proot aarch64 con Python soportado o cambia la version de Python."
  python - <<'PY'
import importlib
mods = ["colorama", "PIL", "numpy", "scipy", "cv2", "onnxruntime"]
for mod in mods:
    importlib.import_module(mod)
print("python_nsfw_stack_ok_with_onnxruntime")
PY
  ok "Python, Pillow, NumPy, SciPy, OpenCV y ONNX Runtime importan correctamente."
}

test_python_daemon() {
  if [ ! -f "${BOT_DIR}/comandos_cerbero/nsfw_daemon.py" ]; then
    return
  fi

  section "Daemon anti-NSFW"
  say "Probando daemon Python anti-NSFW..."
  cd "$BOT_DIR"
  . "${VENV_DIR}/bin/activate"
  env NSFW_ENABLE_PY_ORT=1 NSFW_ENABLE_PY_CV2=0 NSFW_PY_WORKERS=1 NSFW_PY_CV2_THREADS=1 \
    timeout 12s python comandos_cerbero/nsfw_daemon.py >/tmp/cerbero_nsfw_daemon_test.out 2>/tmp/cerbero_nsfw_daemon_test.err <<<'{"id":"setup_probe","path":"/dev/null"}' || true
  if grep -q '"status": "ready"\|"status":"ready"' /tmp/cerbero_nsfw_daemon_test.out; then
    ok "Daemon Python listo para activarse con NSFW_ENABLE_PY_DAEMON=1."
  else
    warn "El daemon Python no confirmo ready durante la prueba. Revisa /tmp/cerbero_nsfw_daemon_test.err si falla al arrancar el bot."
  fi
}

verify_canvas() {
  section "Canvas nativo obligatorio"
  say "Verificando build/Release/canvas.node y render PNG..."
  cd "$BOT_DIR"
  node scripts/verify-arm-canvas.js
  ok "canvas funciona: blackjack y confesiones pueden renderizar imagenes."
}

verify_node_imports() {
  section "Imports criticos"
  say "Probando comandos que dependen de canvas y emojis..."
  cd "$BOT_DIR"
  node --input-type=module -e "await import('./comandos_cerbero/confesiones.js'); console.log('confesiones_import_ok')"
  node --input-type=module -e "await import('./comandos_cerbero/blackjack_cards.js'); console.log('blackjack_import_ok')"
  ok "confesiones.js y blackjack_cards.js cargan correctamente."
}

verify_node_gyp() {
  section "node-gyp local"
  cd "$BOT_DIR"
  if [ ! -x "${BOT_DIR}/node_modules/.bin/node-gyp" ]; then
    die "node-gyp no quedo instalado en node_modules/.bin. Revisa package.json y ejecuta de nuevo npm run setup:arm."
  fi
  "${BOT_DIR}/node_modules/.bin/node-gyp" --version
  ok "node-gyp local disponible para compilar modulos nativos."
}

setup_node_env() {
  section "Dependencias Node"
  local node_gyp_bin="${BOT_DIR}/node_modules/.bin/node-gyp"
  local python_bin
  python_bin="$(command -v python3)"

  say "Instalando limpio sin scripts para evitar builds prematuros de canvas..."
  cd "$BOT_DIR"
  if [ -f package-lock.json ]; then
    say "package-lock.json detectado: usando npm ci para evitar node_modules corrupto."
    npm_config_python="$python_bin" npm_config_build_from_source=true npm ci --include=dev --ignore-scripts
  else
    npm_config_python="$python_bin" npm_config_build_from_source=true npm install --include=dev --ignore-scripts
  fi
  verify_node_gyp
  say "Reconstruyendo canvas desde fuente: esta parte es critica en ARM/proot."
  npm_config_python="$python_bin" npm_config_node_gyp="$node_gyp_bin" npm_config_build_from_source=true npm rebuild canvas --build-from-source
  npm_config_python="$python_bin" npm_config_node_gyp="$node_gyp_bin" npm rebuild sharp --build-from-source || warn "sharp no se pudo reconstruir desde fuente; se usara el paquete instalado por npm si funciona."
  npm run postinstall --if-present
  verify_canvas
  verify_node_imports
  node --check index.js
  node --check comandos_cerbero/confesiones.js
  node --check comandos_cerbero/blackjack_cards.js
  [ -f comandos_cerbero/nsfw_classifier.js ] && node --check comandos_cerbero/nsfw_classifier.js
  [ -f comandos_cerbero/nsfw_detector.js ] && node --check comandos_cerbero/nsfw_detector.js
  ok "Dependencias Node y chequeos de sintaxis completados."
}

write_arm_env() {
  section "Perfil ARM"
  say "Escribiendo variables recomendadas en ${ENV_FILE}..."
  cat > "$ENV_FILE" <<'EOF'
# CERBERO-BOT ARM/proot profile
# Cargalo con: source .env.arm
export PATH="$PWD/.venv/bin:$HOME/.local/bin:$PATH"

# Anti-NSFW en ARM: Python primero, motores nativos Node apagados por defecto.
export NSFW_ENABLE_PY_DAEMON=1
export NSFW_DISABLE_XENOVA=1
export NSFW_DISABLE_NSFWJS=1
export NSFW_ENABLE_PY_CV2=0
export NSFW_ENABLE_PY_ORT=1
export NSFW_PY_WORKERS=1
export NSFW_PY_CV2_THREADS=1
export NSFW_MAX_CONCURRENCY=1
export NSFW_MAX_QUEUE=4
export PYTHONUNBUFFERED=1
export OMP_NUM_THREADS=1
export OPENBLAS_NUM_THREADS=1
export MKL_NUM_THREADS=1
export NUMEXPR_NUM_THREADS=1
EOF
  ok "Perfil .env.arm creado."
}

print_next_steps() {
  local start_cmd="npm start"
  if [ -f "${BOT_DIR}/kerbero2.py" ]; then
    start_cmd="python3 kerbero2.py"
  fi

  cat <<EOF

${BLUE}${BOLD}${LOG_PREFIX} Entorno ARM preparado y canvas verificado.${RESET}

Para iniciar:

  cd "$BOT_DIR"
  source .env.arm
  ${start_cmd}

EOF
}

main() {
  cd "$BOT_DIR"
  case "${1:-}" in
    -h|--help|help)
      usage
      return 0
      ;;
  esac

  banner
  local pm
  pm="$(detect_pm)"
  section "Preflight"
  say "Directorio del bot: ${BOT_DIR}"
  say "Arquitectura detectada: $(uname -m)"
  ok "Gestor de paquetes detectado: ${pm}"
  install_system_packages "$pm"
  ensure_node "$pm"
  setup_python_env
  test_python_daemon
  setup_node_env
  write_arm_env
  print_next_steps
  finish_ok
}

main "$@"

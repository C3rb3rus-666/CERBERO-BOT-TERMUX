#!/bin/bash
# =============================================================
#  ⛧  CERBERO-BOT — Instalador Linux x64
#  Coded by C3rb3rus-666 · carlos sanchez
#  Soporta: Debian · Ubuntu · Kali · Arch · Manjaro · Fedora · RHEL
#  Requisito: Linux x64 (amd64)
#  Contacto: +57 3233704652 | @C3rb3rus_666
# =============================================================

set -e

# ── Colores ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Banner ────────────────────────────────────────────────────
echo -e "${BLUE}"
echo '  ╔══════════════════════════════════════╗'
echo '  ║   ⛧   C E R B E R O - B O T   ⛧    ║'
echo '  ║       Instalador Linux  x64          ║'
echo '  ║       Coded by C3rb3rus-666          ║'
echo '  ╚══════════════════════════════════════╝'
echo -e "${NC}"

# ── Verificar arquitectura ────────────────────────────────────
ARCH=$(uname -m)
if [[ "$ARCH" != "x86_64" && "$ARCH" != "amd64" ]]; then
    echo -e "${RED}[ERROR] Este instalador es exclusivo para Linux x64 (amd64).${NC}"
    echo -e "${RED}        Arquitectura detectada: $ARCH${NC}"
    echo -e "${YELLOW}        Si usas ARM/Android consulta el instalador de CERBERO-BOT-TERMUX.${NC}"
    exit 1
fi

# ── Verificar que es Linux ────────────────────────────────────
if [[ "$(uname -s)" != "Linux" ]]; then
    echo -e "${RED}[ERROR] Solo compatible con Linux.${NC}"
    exit 1
fi

echo -e "${CYAN}[INFO]${NC} Sistema: $(uname -s) | Arch: $ARCH"
echo -e "${CYAN}[INFO]${NC} Usuario: $(whoami) | Root: $([ "$(id -u)" = "0" ] && echo 'sí' || echo 'no')"

# ── Función para correr comandos con sudo si no es root ───────
IS_ROOT=false
[ "$(id -u)" = "0" ] && IS_ROOT=true

run_cmd() {
    if [ "$IS_ROOT" = true ]; then
        "$@"
    else
        sudo "$@"
    fi
}

# ── Asegurar PATH local ───────────────────────────────────────
export PATH="$HOME/.local/bin:$PATH"
mkdir -p "$HOME/.local/bin"

# =============================================================
# 1. DEPENDENCIAS DEL SISTEMA
# =============================================================
echo -e "\n${YELLOW}[1/6] Instalando dependencias del sistema...${NC}"

if command -v apt-get &>/dev/null; then
    echo -e "${GREEN}  ✓ Detectado: Debian / Ubuntu / Kali / Mint${NC}"
    run_cmd apt-get update -qq
    run_cmd apt-get install -y \
        build-essential \
        python3 python3-pip python3-venv \
        ffmpeg git curl wget \
        nodejs npm

elif command -v pacman &>/dev/null; then
    echo -e "${GREEN}  ✓ Detectado: Arch Linux / Manjaro / EndeavourOS${NC}"
    run_cmd pacman -Syu --noconfirm --needed \
        base-devel \
        python python-pip \
        ffmpeg git curl wget \
        nodejs npm

elif command -v dnf &>/dev/null; then
    echo -e "${GREEN}  ✓ Detectado: Fedora / RHEL 9+ / Rocky / Alma${NC}"
    run_cmd dnf groupinstall -y "Development Tools"
    run_cmd dnf install -y \
        python3 python3-pip \
        ffmpeg git curl wget \
        nodejs npm

elif command -v yum &>/dev/null; then
    echo -e "${GREEN}  ✓ Detectado: CentOS / RHEL 7-8${NC}"
    run_cmd yum groupinstall -y "Development Tools"
    run_cmd yum install -y \
        python3 python3-pip \
        ffmpeg git curl wget

else
    echo -e "${YELLOW}  [!] Gestor de paquetes no reconocido.${NC}"
    echo -e "      Asegúrate de tener instalados: build-essential, python3, pip, ffmpeg, git, nodejs"
fi

echo -e "${GREEN}  ✓ Dependencias del sistema listas${NC}"

# =============================================================
# 2. ENTORNO PYTHON (VENV)
# =============================================================
echo -e "\n${YELLOW}[2/6] Configurando entorno Python virtual...${NC}"

VENV_DIR="$HOME/.cerbero-venv"

# Detectar python3
PY_CMD=""
for cmd in python3 python; do
    if command -v "$cmd" &>/dev/null; then
        PY_CMD="$cmd"
        break
    fi
done

if [ -z "$PY_CMD" ]; then
    echo -e "${RED}[ERROR] Python no encontrado. Instálalo con tu gestor de paquetes.${NC}"
    exit 1
fi

PY_VERSION=$($PY_CMD --version 2>&1)
echo -e "${CYAN}  [INFO]${NC} $PY_VERSION"

# Crear venv
if [ ! -d "$VENV_DIR" ]; then
    echo -e "  Creando venv en $VENV_DIR ..."
    $PY_CMD -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
echo -e "${GREEN}  ✓ Venv activo: $VENV_DIR${NC}"

# Instalar yt-dlp en el venv
pip install --upgrade pip --quiet
pip install --upgrade yt-dlp --quiet
echo -e "${GREEN}  ✓ yt-dlp $(yt-dlp --version 2>/dev/null || echo 'instalado') en venv${NC}"

# Wrapper en ~/.local/bin para que yt-dlp funcione fuera del venv
WRAPPER="$HOME/.local/bin/yt-dlp"
cat > "$WRAPPER" <<EOF
#!/bin/bash
source "$VENV_DIR/bin/activate"
yt-dlp "\$@"
EOF
chmod +x "$WRAPPER"
echo -e "${GREEN}  ✓ Wrapper yt-dlp → $WRAPPER${NC}"

deactivate

# =============================================================
# 3. NODE.JS 20 VIA NVM
# =============================================================
echo -e "\n${YELLOW}[3/6] Configurando Node.js 20 via NVM...${NC}"

export NVM_DIR="$HOME/.nvm"

if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    echo -e "  Instalando NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

source "$NVM_DIR/nvm.sh"

nvm install 20 --silent
nvm use 20
nvm alias default 20

echo -e "${GREEN}  ✓ Node: $(node -v) | NPM: $(npm -v)${NC}"

# =============================================================
# 4. ESTRUCTURA DE DIRECTORIOS
# =============================================================
echo -e "\n${YELLOW}[4/6] Creando estructura de directorios...${NC}"

DIRS=(
    "sessions"
    "temp"
    "tmp"
    "logs"
    "backup/sessions"
    "comandos_cerbero/juegos"
    "comandos_cerbero/imagenes"
    "comandos_cerbero/configuraciones"
    "comandos_cerbero/sticker_bienvenida"
    "comandos_cerbero/temp"
    "utils"
    "config"
)

for dir in "${DIRS[@]}"; do
    mkdir -p "$dir"
    echo -e "  ${GREEN}✓${NC} $dir/"
done

# =============================================================
# 5. DEPENDENCIAS NPM
# =============================================================
echo -e "\n${YELLOW}[5/6] Instalando dependencias NPM...${NC}"

if [ ! -f "package.json" ]; then
    echo -e "${RED}[ERROR] package.json no encontrado.${NC}"
    echo -e "        Ejecuta este script desde el directorio raíz del bot."
    exit 1
fi

npm install --legacy-peer-deps
echo -e "${GREEN}  ✓ Dependencias NPM instaladas${NC}"

# =============================================================
# 6. ARCHIVOS DE CONFIGURACIÓN Y LAUNCHERS
# =============================================================
echo -e "\n${YELLOW}[6/6] Generando configuración y launchers...${NC}"

# .env.local
if [ ! -f ".env.local" ]; then
    cat > .env.local <<'EOF'
# CERBERO-BOT — Configuración
# Agrega tu clave de Gemini si usas la IA
# GEMINI_API_KEY=tu_clave_aqui
EOF
    echo -e "  ${GREEN}✓${NC} .env.local creado"
fi

# .gitignore
if [ ! -f ".gitignore" ]; then
    cat > .gitignore <<'EOF'
node_modules/
sessions/
.env
.env.local
*.log
temp/
tmp/
backup/
models_cache/
EOF
    echo -e "  ${GREEN}✓${NC} .gitignore creado"
fi

# start.sh — lanzador normal
cat > start.sh <<'EOF'
#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
export PATH="$HOME/.local/bin:$PATH"
[ -f "$HOME/.cerbero-venv/bin/activate" ] && source "$HOME/.cerbero-venv/bin/activate"
echo "⛧ Iniciando CERBERO-BOT..."
node --experimental-global-webcrypto index.js
EOF
chmod +x start.sh

# start-bg.sh — lanzador en background
cat > start-bg.sh <<'EOF'
#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
export PATH="$HOME/.local/bin:$PATH"
[ -f "$HOME/.cerbero-venv/bin/activate" ] && source "$HOME/.cerbero-venv/bin/activate"
nohup node --experimental-global-webcrypto index.js > bot.log 2>&1 &
echo "⛧ CERBERO-BOT corriendo en background. PID: $!"
echo "  Ver logs: tail -f bot.log"
echo "  Detener: kill $!"
EOF
chmod +x start-bg.sh

echo -e "  ${GREEN}✓${NC} start.sh y start-bg.sh generados"

# =============================================================
# RESUMEN FINAL
# =============================================================
echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅  INSTALACIÓN COMPLETADA         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Próximos pasos:${NC}"
echo -e "  1. Configura tu clave API en ${CYAN}.env.local${NC} (si usas IA)"
echo -e "  2. Inicia el bot:    ${BOLD}./start.sh${NC}"
echo -e "  3. Background:       ${BOLD}./start-bg.sh${NC}"
echo -e "  4. Ver logs:         ${BOLD}tail -f bot.log${NC}"
echo ""
echo -e "  ${CYAN}¿Quieres un bot como este?${NC}"
echo -e "  📱 WhatsApp : +57 3233704652"
echo -e "  ✈️  Telegram : @C3rb3rus_666"
echo ""

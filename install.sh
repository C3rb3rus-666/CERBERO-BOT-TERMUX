#!/bin/bash

# ==========================================
# 🤖 CERBERO-BOT INSTALLATION SCRIPT
# Compatible: Linux x64 & ARM64
# Optimizado para PEP 668 (Break System Packages)
# ==========================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}┌────────────────────────────────────┐${NC}"
echo -e "${BLUE}│  🤖 CERBERO-BOT INSTALLATION       │${NC}"
echo -e "${BLUE}│  By C3rb3rus-666                   │${NC}"
echo -e "${BLUE}└────────────────────────────────────┘${NC}"

# ==========================================
# 🛠️ FUNCIONES DE UTILIDAD
# ==========================================

# Función inteligente para instalar paquetes pip saltando restricciones
safe_pip_install() {
    PACKAGE_NAME=$1
    echo -e "${BLUE}[*] Instalando paquete Python: $PACKAGE_NAME...${NC}"

    # Determinar comando python
    if command -v python3 &> /dev/null; then
        PY_CMD="python3"
    else
        PY_CMD="python"
    fi

    # Detectar si pip soporta --break-system-packages
    PIP_ARGS=""
    if $PY_CMD -m pip install --help | grep -q "break-system-packages"; then
        PIP_ARGS="--break-system-packages"
        echo -e "${YELLOW}   -> Detectado entorno gestionado. Usando flag: $PIP_ARGS${NC}"
    fi

    # Intentar instalación
    if command -v sudo &> /dev/null; then
        # Intentar instalar globalmente con sudo y flag si es necesario
        sudo $PY_CMD -m pip install --upgrade "$PACKAGE_NAME" $PIP_ARGS
    else
        # Si no hay sudo (ej. Termux), usar --user si no es root, o directo
        $PY_CMD -m pip install --upgrade "$PACKAGE_NAME" $PIP_ARGS
    fi
}

# ==========================================
# 🔍 DETECCIÓN DE SISTEMA Y ARQUITECTURA
# ==========================================
echo -e "\n${YELLOW}[*] Detectando sistema y arquitectura...${NC}"

OS=$(uname -s)
ARCH=$(uname -m)
TERMUX=false

# Detectar si es Termux
if grep -qiE 'com.termux' /proc/*/cmdline 2>/dev/null || [ -n "$PREFIX" ] && [[ "$PREFIX" == *termux* ]]; then
    TERMUX=true
    echo -e "${GREEN}✓ Entorno Termux detectado${NC}"
fi

echo "OS: $OS"
echo "Arquitectura: $ARCH"

if [[ "$OS" != "Linux" ]]; then
    echo -e "${RED}❌ Este script solo soporta Linux/Android (Termux)${NC}"
    exit 1
fi

# Normalizar arquitectura
case "$ARCH" in
    armv7l|arm) ARCH_TYPE="arm32" ;;
    aarch64|arm64) ARCH_TYPE="arm64" ;;
    x86_64|amd64) ARCH_TYPE="amd64" ;;
    *) ARCH_TYPE="$ARCH" ;;
esac

echo "Tipo de arquitectura: $ARCH_TYPE"

# Asegurar PATH local
export PATH="$HOME/.local/bin:$PATH"
mkdir -p "$HOME/.local/bin" 2>/dev/null || true

# ==========================================
# 📦 INSTALACIÓN DE DEPENDENCIAS
# ==========================================
echo -e "\n${YELLOW}[*] Instalando dependencias del sistema...${NC}"

if [ "$TERMUX" = true ]; then
    echo -e "${GREEN}✓ Instalando dependencias en Termux${NC}"
    pkg update -y && pkg upgrade -y
    pkg install -y python ffmpeg git curl wget
    
    # Node.js según arquitectura
    if [ "$ARCH_TYPE" = "arm32" ]; then
        pkg install -y nodejs
    else
        pkg install -y nodejs
    fi
    
    # Instalar dependencias Python
    safe_pip_install "pip"
    safe_pip_install "yt-dlp"

elif command -v apt-get &> /dev/null; then
    echo -e "${GREEN}✓ Detectado: Debian/Ubuntu/Kali${NC}"
    sudo apt-get update
    sudo apt-get install -y build-essential python3-dev python3-pip ffmpeg git curl wget
    
    # Instalar dependencias Python (usando la función inteligente)
    safe_pip_install "pip"
    safe_pip_install "yt-dlp"

elif command -v pacman &> /dev/null; then
    echo -e "${GREEN}✓ Detectado: Arch Linux / Manjaro${NC}"
    sudo pacman -Syu --noconfirm --needed base-devel python python-pip ffmpeg git curl wget nodejs npm
    
    # Instalar dependencias Python
    safe_pip_install "pip"
    safe_pip_install "yt-dlp"

elif command -v yum &> /dev/null; then
    echo -e "${GREEN}✓ Detectado: RedHat/CentOS${NC}"
    sudo yum groupinstall -y "Development Tools"
    sudo yum install -y python3-devel python3-pip ffmpeg git curl wget
    
    # Instalar dependencias Python
    safe_pip_install "pip"
    safe_pip_install "yt-dlp"

else
    echo -e "${YELLOW}⚠️ Gestor de paquetes no detectado automáticamante.${NC}"
    echo "Asegúrate de tener instalado: ffmpeg, python3, pip, git"
fi

# Advertencia especial para ARM 32 bits
if [ "$ARCH_TYPE" = "arm32" ]; then
    echo -e "${YELLOW}⚠️ Estás usando ARM 32 bits. Algunas dependencias pueden requerir compilación manual.${NC}"
fi

echo -e "${GREEN}✓ Dependencias del sistema instaladas${NC}"

# ==========================================
# ✅ VERIFICACIÓN DE YT-DLP
# ==========================================
if ! command -v yt-dlp &> /dev/null; then
    echo -e "${YELLOW}⚠️ yt-dlp no encontrado en PATH tras instalación. Creando wrapper...${NC}"
    WRAPPER="$HOME/.local/bin/yt-dlp"
    
    cat > "$WRAPPER" <<'SH'
#!/bin/sh
if command -v python3 >/dev/null 2>&1; then
  python3 -m yt_dlp "$@"
elif command -v python >/dev/null 2>&1; then
  python -m yt_dlp "$@"
else
  echo "Error: Python no encontrado." >&2
  exit 1
fi
SH
    chmod +x "$WRAPPER"
    echo -e "${GREEN}✓ Wrapper creado en $WRAPPER${NC}"
fi

# ==========================================
# 🔧 SETUP NVM & NODE.JS
# ==========================================
echo -e "\n${YELLOW}[*] Configurando NVM y Node.js 20...${NC}"

export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
else
    echo -e "${YELLOW}⚠️ Instalando NVM...${NC}"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    source "$NVM_DIR/nvm.sh"
fi

# Instalar Node 20
nvm install 20
nvm use 20
nvm alias default 20

echo -e "${GREEN}✓ Node: $(node -v) | NPM: $(npm -v)${NC}"

# ==========================================
# ✅ CREAR ESTRUCTURA DE CARPETAS
# ==========================================
echo -e "\n${YELLOW}[*] Validando directorios...${NC}"

DIRS=(
    "sessions"
    "comandos_cerbero/juegos"
    "comandos_cerbero/imagenes"
    "comandos_cerbero/configuraciones"
    "comandos_cerbero/sticker_bienvenida"
    "comandos_cerbero/temp"
    "utils"
    "logs"
    "temp"
    "backup/sessions"
)

for dir in "${DIRS[@]}"; do
    mkdir -p "$dir"
    echo -e "  ${GREEN}✓${NC} $dir"
done

# ==========================================
# 📦 INSTALACIÓN DE PAQUETES NPM
# ==========================================
echo -e "\n${YELLOW}[*] Instalando dependencias del bot (NPM)...${NC}"
npm install --force --legacy-peer-deps
echo -e "${GREEN}✓ Dependencias NPM instaladas${NC}"

# ==========================================
# 🔐 ARCHIVOS DE CONFIGURACIÓN
# ==========================================
if [ ! -f .env.local ]; then
    cat > .env.local << 'EOF'
# Configurar tu clave API de Gemini aqui
GEMINI_API_KEY=your_gemini_api_key_here
EOF
    echo -e "${GREEN}✓ .env.local creado${NC}"
fi

if [ ! -f .gitignore ]; then
    cat > .gitignore << 'EOF'
node_modules/
sessions/
.env
.env.local
*.log
temp/
tmp/
backup/
EOF
    echo -e "${GREEN}✓ .gitignore creado${NC}"
fi

# ==========================================
# 🚀 SCRIPTS DE INICIO
# ==========================================
echo -e "\n${YELLOW}[*] Generando launchers...${NC}"

# Launcher Normal
cat > start.sh << 'EOF'
#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20
export PATH="$HOME/.local/bin:$PATH"
echo "🤖 Iniciando CERBERO-BOT..."
node --experimental-global-webcrypto index.js
EOF
chmod +x start.sh

# Launcher Background
cat > start-bg.sh << 'EOF'
#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20
export PATH="$HOME/.local/bin:$PATH"
echo "🤖 CERBERO-BOT background start..."
nohup node --experimental-global-webcrypto index.js > bot.log 2>&1 &
echo "✓ PID: $!"
EOF
chmod +x start-bg.sh

echo -e "${GREEN}✓ start.sh y start-bg.sh creados${NC}"

# ==========================================
# 📋 FINAL
# ==========================================
echo -e "\n${GREEN}┌────────────────────────────────────┐${NC}"
echo -e "${GREEN}│  ✅ INSTALACIÓN COMPLETADA         │${NC}"
echo -e "${GREEN}└────────────────────────────────────┘${NC}"
echo -e "${YELLOW}>> Ejecuta ./start.sh para iniciar${NC}"

#!/bin/bash

# ==========================================
# 🤖 CERBERO-BOT INSTALLATION SCRIPT
# Compatible: Linux x64 & ARM64
# ==========================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}┌────────────────────────────────────┐${NC}"
echo -e "${BLUE}│  🤖 CERBERO-BOT INSTALLATION      │${NC}"
echo -e "${BLUE}│  By C3rb3rus-666                   │${NC}"
echo -e "${BLUE}└────────────────────────────────────┘${NC}"

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
    armv7l|arm)
        ARCH_TYPE="arm32" ;;
    aarch64|arm64)
        ARCH_TYPE="arm64" ;;
    x86_64|amd64)
        ARCH_TYPE="amd64" ;;
    *)
        ARCH_TYPE="$ARCH" ;;
esac

echo "Tipo de arquitectura: $ARCH_TYPE"


# ==========================================
# 📦 INSTALACIÓN DE DEPENDENCIAS SEGÚN ENTORNO Y ARQUITECTURA
# ==========================================
echo -e "\n${YELLOW}[*] Instalando dependencias del sistema...${NC}"

if [ "$TERMUX" = true ]; then
    echo -e "${GREEN}✓ Instalando dependencias en Termux${NC}"
    pkg update -y && pkg upgrade -y
    pkg install -y python ffmpeg git curl wget
    # Node.js según arquitectura
    if [ "$ARCH_TYPE" = "arm32" ]; then
        pkg install -y nodejs
    elif [ "$ARCH_TYPE" = "arm64" ]; then
        pkg install -y nodejs
    elif [ "$ARCH_TYPE" = "amd64" ]; then
        pkg install -y nodejs
    else
        echo -e "${YELLOW}⚠️ Arquitectura no reconocida para Node.js en Termux. Intenta instalar manualmente.${NC}"
    fi
    pip install --upgrade pip
    pip install --upgrade yt-dlp
elif command -v apt-get &> /dev/null; then
    echo -e "${GREEN}✓ Detectado: Debian/Ubuntu${NC}"
    echo -e "${BLUE}[*] Ejecutando: sudo apt-get update (salida completa)${NC}"
    sudo apt-get update
    echo -e "${BLUE}[*] Ejecutando: sudo apt-get install -y (salida completa)${NC}"
    sudo apt-get install -y \
        build-essential \
        python3-dev \
        python3-pip \
        ffmpeg \
        git \
        curl \
        wget
    echo -e "${BLUE}[*] Instalando/actualizando yt-dlp (usando python3 -m pip)${NC}"
    if command -v sudo &> /dev/null; then
        sudo python3 -m pip install --upgrade pip
        sudo python3 -m pip install --upgrade yt-dlp
    else
        python3 -m pip install --upgrade pip --user
        python3 -m pip install --upgrade yt-dlp --user
    fi
elif command -v pacman &> /dev/null; then
    echo -e "${GREEN}✓ Detectado: Arch Linux / Manjaro${NC}"
    echo -e "${BLUE}[*] Ejecutando: sudo pacman -Syu --noconfirm --needed (salida completa)${NC}"
    sudo pacman -Syu --noconfirm --needed \
        base-devel \
        python \
        python-pip \
        ffmpeg \
        git \
        curl \
        wget \
        nodejs \
        npm
    echo -e "${BLUE}[*] Instalando/actualizando yt-dlp (usando python3 -m pip si está disponible)${NC}"
    # Preferir python3 -m pip; si no existe usar python -m pip
    PY_CMD=""
    if command -v python3 &> /dev/null; then
        PY_CMD=python3
    elif command -v python &> /dev/null; then
        PY_CMD=python
    fi

    if [ -n "$PY_CMD" ]; then
        if command -v sudo &> /dev/null; then
            sudo $PY_CMD -m pip install --upgrade pip
            sudo $PY_CMD -m pip install --upgrade yt-dlp
        else
            $PY_CMD -m pip install --upgrade pip --user
            $PY_CMD -m pip install --upgrade yt-dlp --user
        fi
    else
        echo -e "${YELLOW}⚠️ No se encontró Python en PATH. Instala Python y ejecuta: python3 -m pip install --upgrade yt-dlp${NC}"
    fi
elif command -v yum &> /dev/null; then
    echo -e "${GREEN}✓ Detectado: RedHat/CentOS${NC}"
    echo -e "${BLUE}[*] Ejecutando: sudo yum groupinstall -y 'Development Tools' (salida completa)${NC}"
    sudo yum groupinstall -y "Development Tools"
    echo -e "${BLUE}[*] Ejecutando: sudo yum install -y (salida completa)${NC}"
    sudo yum install -y \
        python3-devel \
        python3-pip \
        ffmpeg \
        git \
        curl \
        wget
    echo -e "${BLUE}[*] Instalando/actualizando yt-dlp (usando python3 -m pip si está disponible)${NC}"
    if command -v python3 &> /dev/null; then
        if command -v sudo &> /dev/null; then
            sudo python3 -m pip install --upgrade pip
            sudo python3 -m pip install --upgrade yt-dlp
        else
            python3 -m pip install --upgrade pip --user
            python3 -m pip install --upgrade yt-dlp --user
        fi
    else
        echo -e "${YELLOW}⚠️ No se encontró Python 3 en PATH. Instala Python3 y ejecuta: python3 -m pip install --upgrade yt-dlp${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Gestor de paquetes no detectado.${NC}"
    echo "Por favor, instala manualmente:"
    echo "  - ffmpeg"
    echo "  - yt-dlp (pip install yt-dlp)"
    echo "  - Python 3"
    echo "  - Node.js 20+"
fi


# Advertencia especial para ARM 32 bits
if [ "$ARCH_TYPE" = "arm32" ]; then
    echo -e "${YELLOW}⚠️ Estás usando ARM 32 bits. Algunas dependencias de Node.js pueden no funcionar o requerir compilación manual.${NC}"
    echo -e "${YELLOW}   Si tienes problemas, revisa la documentación de cada paquete o busca alternativas compatibles.${NC}"
fi

echo -e "${GREEN}✓ Dependencias del sistema instaladas${NC}"

# ==========================================
# ✅ Verificar que yt-dlp esté disponible
# ==========================================
if command -v yt-dlp &> /dev/null; then
    echo -e "${GREEN}✓ yt-dlp: disponible en PATH${NC}"
else
    # Try to detect via python -m yt_dlp
    if command -v python3 &> /dev/null || command -v python &> /dev/null; then
        echo -e "${YELLOW}⚠️ yt-dlp no se encuentra en PATH, pero Python está instalado. Asegurando instalación con python -m pip...${NC}"
        PY_CMD=""
        if command -v python3 &> /dev/null; then
            PY_CMD=python3
        else
            PY_CMD=python
        fi
        if command -v sudo &> /dev/null; then
            sudo $PY_CMD -m pip install --upgrade yt-dlp
        else
            $PY_CMD -m pip install --upgrade yt-dlp --user
        fi
        if command -v yt-dlp &> /dev/null; then
            echo -e "${GREEN}✓ yt-dlp instalado correctamente${NC}"
        else
            echo -e "${RED}❌ No se pudo instalar yt-dlp automáticamente. Instálalo manualmente: python3 -m pip install --upgrade yt-dlp${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ yt-dlp no encontrado y Python no está disponible. Instala Python y yt-dlp manualmente.${NC}"
    fi
fi
# ==========================================
# 🔧 SETUP NVM & NODE.JS
# ==========================================
echo -e "\n${YELLOW}[*] Configurando NVM y Node.js 20...${NC}"

# Cargar NVM
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
    echo -e "${GREEN}✓ NVM cargado${NC}"
else
    echo -e "${YELLOW}⚠️ NVM no está instalado. Intentando instalar automáticamente...${NC}"
    # Intentar instalar NVM de forma no interactiva
    if command -v curl >/dev/null 2>&1; then
        echo "Descargando script de instalación de NVM..."
        if curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash; then
            # Cargar NVM si la instalación creó el script
            if [ -s "$NVM_DIR/nvm.sh" ]; then
                # shellcheck source=/dev/null
                source "$NVM_DIR/nvm.sh"
                echo -e "${GREEN}✓ NVM instalado y cargado${NC}"
            else
                echo -e "${RED}❌ Instalación de NVM falló (nvm.sh no encontrado). Revisa manualmente.${NC}"
                exit 1
            fi
        else
            echo -e "${RED}❌ Error descargando/ejecutando instalador de NVM. Instálalo manualmente:${NC}"
            echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
            exit 1
        fi
    else
        echo -e "${RED}❌ curl no está disponible. Instala curl y vuelve a ejecutar${NC}"
        exit 1
    fi
fi

# Instalar Node 20
nvm install 20 > /dev/null 2>&1
nvm use 20 > /dev/null 2>&1
nvm alias default 20 > /dev/null 2>&1

echo -e "${GREEN}✓ Node.js versión: $(node --version)${NC}"
echo -e "${GREEN}✓ NPM versión: $(npm --version)${NC}"

# ==========================================
# ✅ VERIFY DIRECTORIES (sin crear si existen)
# ==========================================
echo -e "\n${YELLOW}[*] Validando estructura de directorios...${NC}"

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
    if [ -d "$dir" ]; then
        echo -e "  ${GREEN}✓${NC} $dir"
    else
        echo -e "  ${RED}✗${NC} $dir (faltante, se crearía si es necesario)"
    fi
done

# ==========================================
# 📦 INSTALL NPM DEPENDENCIES (FORCED)
# ==========================================
echo -e "\n${YELLOW}[*] Instalando dependencias de Node.js con --force...${NC}"

echo -e "${BLUE}[*] Ejecutando: npm install --force --legacy-peer-deps (mostrando salida completa)${NC}"
npm install --force --legacy-peer-deps

echo -e "${GREEN}✓ Dependencias de Node.js instaladas${NC}"

# ==========================================
# 🔐 SETUP ENVIRONMENT FILES
# ==========================================
echo -e "\n${YELLOW}[*] Validando archivos de configuración...${NC}"

if [ ! -f .env.local ]; then
    echo -e "${YELLOW}⚠️ .env.local no encontrado${NC}"
    cat > .env.local << 'EOF'
# Configurar tu clave API de Gemini aqui
GEMINI_API_KEY=your_gemini_api_key_here
EOF
    echo -e "${GREEN}✓ .env.local creado (edita con tu clave)${NC}"
else
    echo -e "${GREEN}✓ .env.local ya existe${NC}"
fi

if [ ! -f .gitignore ]; then
    cat > .gitignore << 'EOF'
node_modules/
sessions/
.env
.env.local
.env*.local
*.log
temp/
tmp/
backup/sessions/
.DS_Store
EOF
    echo -e "${GREEN}✓ .gitignore creado${NC}"
else
    echo -e "${GREEN}✓ .gitignore ya existe${NC}"
fi

# ==========================================
# 🚀 CREATE STARTUP SCRIPTS
# ==========================================
echo -e "\n${YELLOW}[*] Creando scripts de inicio...${NC}"

cat > start.sh << 'EOF'
#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20
cd "$(dirname "$0")"
echo "🤖 Iniciando CERBERO-BOT..."
node --experimental-global-webcrypto index.js
EOF

chmod +x start.sh
echo -e "${GREEN}✓ start.sh creado${NC}"

cat > start-bg.sh << 'EOF'
#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20
cd "$(dirname "$0")"
echo "🤖 CERBERO-BOT iniciando en background..."
nohup node --experimental-global-webcrypto index.js > bot.log 2>&1 &
echo "✓ Proceso iniciado (PID: $!)"
echo "📋 Ver logs: tail -f bot.log"
EOF

chmod +x start-bg.sh
echo -e "${GREEN}✓ start-bg.sh creado${NC}"

# ==========================================
# ✅ FINAL VERIFICATION
# ==========================================
echo -e "\n${YELLOW}[*] Verificando instalación...${NC}"

echo "  Node.js: $(node --version)"
echo "  NPM: $(npm --version)"
echo "  Python3: $(python3 --version 2>&1)"
echo "  FFmpeg: $(ffmpeg -version 2>/dev/null | head -1 || echo '⚠️ No instalado')"

if command -v yt-dlp &> /dev/null; then
    echo "  yt-dlp: ✓"
else
    echo "  yt-dlp: ⚠️ No instalado (intenta: pip3 install yt-dlp)"
fi

# ==========================================
# 📋 FINAL INSTRUCTIONS
# ==========================================
echo -e "\n${GREEN}┌────────────────────────────────────┐${NC}"
echo -e "${GREEN}│  ✅ INSTALACIÓN COMPLETADA        │${NC}"
echo -e "${GREEN}└────────────────────────────────────┘${NC}"

echo -e "\n${BLUE}📝 PRÓXIMOS PASOS:${NC}"
echo ""
echo -e "1. ${YELLOW}Configura tu API Key de Gemini:${NC}"
echo "   nano .env.local  (edita GEMINI_API_KEY)"
echo ""
echo -e "2. ${YELLOW}Inicia el bot:${NC}"
echo "   ./start.sh           (ejecución directa)"
echo "   ./start-bg.sh        (ejecución en background)"
echo ""
echo -e "3. ${YELLOW}Escanea el QR o usa código de emparejamiento${NC}"
echo ""
echo -e "${BLUE}📖 INFORMACIÓN:${NC}"
echo "  • GitHub: github.com/c3rb3rus-666"
echo "  • WhatsApp: +57 323 3704652"
echo "  • Versión: v4.2.3 (Build 65)"
echo ""
echo -e "${YELLOW}💡 COMANDOS ÚTILES:${NC}"
echo "  • Ver logs en tiempo real: tail -f bot.log"
echo "  • Matar el bot: pkill -f 'node.*index.js'"
echo "  • Reiniciar en background: ./start-bg.sh"
echo ""


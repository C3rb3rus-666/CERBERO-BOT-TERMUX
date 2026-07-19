#!/bin/bash
# ============================================================================
# RUN-TERMUX.md — Instrucciones de inicio automatizado en Termux/ARM64
# ============================================================================

## 🎯 RESUMEN DEL PORTE

El bot **CERBERO-BOT** ha sido completamente portado a:
- **Ubicación**: `/home/carlos/Documentos/CERBERO-BOT-TERMUX`
- **Arquitectura**: ARM64/Termux
- **Build**: 97
- **Versión**: v4.4.19-TERMUX
- **Enfoque**: Anti-NSFW optimizado para ARM64

---

## 🚀 INICIO RÁPIDO (SIN INSTALAR DEPENDENCIAS AÚN)

### Paso 1: Acceder a la carpeta
```bash
cd /home/carlos/Documentos/CERBERO-BOT-TERMUX
```

### Paso 2: Configurar variables ARM64 (elegir una opción)

**Opción A: Ejecutar script de inicio (RECOMENDADO)**
```bash
./start-arm64.sh
```

**Opción B: Cargar configuración e instalar después**
```bash
source setup-arm64.sh
npm ci
npm start
```

**Opción C: Usar .env.arm64**
```bash
cp .env.arm64 .env
npm ci
npm start
```

---

## 📋 QUÉ ESTÁ PREPARADO (LISTO PARA USAR)

✅ **Archivos portados completamente**:
- `index.js` — Punto de entrada principal
- `comandos_cerbero/` — Todos los comandos + módulos anti-NSFW
- `utils/` — Utilidades del bot
- `package.json` — Dependencias (v4.4.19, Build 97)
- `start-arm64.sh` — Script de inicio ARM64
- `setup-arm64.sh` — Script de configuración ARM64
- `.env.arm64` — Variables preconfiguradas para ARM
- `README-ARM64.md` — Guía detallada

✅ **Optimizaciones ARM64 implementadas**:
- `nsfw_detector.js` — Anti-NSFW con límites de concurrencia ARM
- `presentaciones.js` — Modo seguro ARM64 sin CLIP/Sharp
- `nsfw_daemon.py` — Detección automática ARM y threads optimizados
- Variables de entorno listas para ARM64

⚠️ **Todavía requiere** (NO está instalado):
- `npm install` o `npm ci` (dependencias Node.js)
- `pip install` (dependencias Python, si se usa nsfw_daemon.py)
- Sesión de WhatsApp (se genera en primera ejecución)

---

## 🔧 VARIABLES ARM64 CONFIGURADAS

### Anti-NSFW
```bash
NSFW_MAX_CONCURRENCY=1              # 1 imagen simultánea en ARM
NSFW_MAX_QUEUE=4                    # Máx 4 en cola
NSFW_DETECTION_TIMEOUT_MS=45000     # 45s timeout
```

### Presentaciones/Tinder
```bash
PRESENTACIONES_ARM_SAFE_MODE=1       # Modo seguro sin CLIP
PRESENTACIONES_FORCE_NATIVE=0        # No fuerza análisis nativo
PRESENTACIONES_CLIP=0                # Desactiva CLIP (pesado)
PRESENTACIONES_MAX_IMAGE_BYTES=6MB   # 6MB (vs 14MB en x86)
PRESENTACIONES_MAX_PENDING=2         # 2 máx en cola
```

### Threads & Memoria
```bash
ONNX_NUM_THREADS=1                   # 1 thread ONNX
OMP_NUM_THREADS=1                    # 1 thread OpenMP
NODE_OPTIONS="--max-old-space-size=512"  # 512MB Node.js
```

---

## ✅ VERIFICAR ANTES DE INSTALAR

1. **Verificar Termux/ARM64**:
```bash
uname -m              # Debe mostrar: aarch64 o arm64
echo $PREFIX          # Debe mostrar ruta Termux (/data/data/com.termux/files/...)
```

2. **Verificar estructura**:
```bash
cd /home/carlos/Documentos/CERBERO-BOT-TERMUX
test -f index.js && test -d comandos_cerbero && test -f package.json && echo "✅ Estructura OK"
```

3. **Verificar scripts**:
```bash
test -x start-arm64.sh && test -x setup-arm64.sh && echo "✅ Scripts ejecutables"
```

---

## 🎯 PRÓXIMOS PASOS (CUANDO ESTÉS LISTO)

### Cuando quieras instalar dependencias y ejecutar:

```bash
cd /home/carlos/Documentos/CERBERO-BOT-TERMUX

# Opción 1: Instalar con npm
npm ci

# Opción 2: O instalar con npm+python (si necesitas nsfw_daemon.py)
npm ci
# (Si tienes pip): pip3 install -r requirements.txt

# Luego ejecutar (el script ya carga variables ARM64)
./start-arm64.sh
```

---

## 📊 MONITOREO DESPUÉS DE INICIAR

```bash
# Ver logs en tiempo real
tail -f start-arm64.log

# Monitorear recursos (en otra terminal Termux)
top -p $(pgrep -f "node index.js")

# Ver estado del bot
ps aux | grep "node index.js"
```

---

## 🔄 INICIO AUTOMATIZADO (OPTIONAL)

Para que Termux ejecute el bot al iniciar la app:

1. Crear archivo `~/.termux/boot/cerbero.sh`:
```bash
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/cerbero.sh << 'EOF'
#!/bin/bash
cd /home/carlos/Documentos/CERBERO-BOT-TERMUX
nohup ./start-arm64.sh >> /tmp/cerbero-boot.log 2>&1 &
EOF
chmod +x ~/.termux/boot/cerbero.sh
```

2. Reiniciar Termux → bot inicia automáticamente

---

## 🆘 TROUBLESHOOTING RÁPIDO

| Problema | Solución |
|----------|----------|
| "comando no encontrado: npm" | Instalar Node.js en Termux: `apt install nodejs` |
| Anti-NSFW lento | Reduce `NSFW_MAX_QUEUE=2` en `.env` |
| Bot consume mucha RAM | Reduce `NODE_OPTIONS` a 256MB |
| Presentaciones falla | Asegura `PRESENTACIONES_ARM_SAFE_MODE=1` |
| nsfw_daemon.py error | Instalar Python: `apt install python3` |

---

## 📝 NOTAS IMPORTANTES

✅ **Todo está preparado para ejecutarse sin cambios**
✅ **Anti-NSFW optimizado para ARM64 (1 thread, 1 imagen simultánea)**
✅ **Presentaciones en modo seguro sin CLIP/Sharp**
✅ **Variables de entorno automáticas en `start-arm64.sh`**
⚠️ **Solo falta: `npm ci` + `npm start`**

---

## 📞 ESTRUCTURA DE ARCHIVOS PORTADA

```
/home/carlos/Documentos/CERBERO-BOT-TERMUX/
├── index.js                    # Punto de entrada
├── package.json                # Dependencies v4.4.19, Build 97
├── .env.arm64                  # Variables ARM64 (copiar a .env)
├── start-arm64.sh              # ✨ Script inicio optimizado
├── setup-arm64.sh              # Configuración ARM64
├── README-ARM64.md             # Guía detallada
├── comandos_cerbero/
│   ├── nsfw_detector.js        # ✨ Anti-NSFW optimizado ARM
│   ├── presentaciones.js       # ✨ Modo seguro ARM64
│   ├── nsfw_daemon.py          # ✨ Daemon Python ARM
│   ├── nsfw_classifier.js
│   ├── *.js                    # Todos los comandos (+50)
│   └── configuraciones/        # Configs modulares
├── utils/
│   ├── brand.js                # v4.4.19-TERMUX · Build 97
│   └── *.js                    # Utilidades
└── config/
    └── *.json                  # Configuraciones globales
```

---

**¡Listo para iniciar!** 🚀

Cuando estés preparado:
```bash
cd /home/carlos/Documentos/CERBERO-BOT-TERMUX
./start-arm64.sh
```

---

**Build**: 97  
**Versión**: v4.4.19-TERMUX  
**Arquitectura**: ARM64  
**Distro**: Termux / Linux ARM  
**Fecha**: 2026-07-19

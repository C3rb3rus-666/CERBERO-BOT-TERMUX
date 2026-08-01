# CERBERO-BOT-TERMUX - Tutorial Unico Debian proot (ARM64)

Este es el unico flujo oficial de instalacion para CERBERO-BOT-TERMUX en Debian proot.
No hay rutas alternativas en este documento.

## 1. Entrar al proyecto

```bash
cd /home/carlos/Documentos/CERBERO-BOT-TERMUX
```

## 2. Instalar dependencias Node

```bash
npm install
```

## 3. Preparar entorno ARM del port

```bash
npm run arm:setup:full
```

Este paso aplica configuracion ARM y valida el port completo:

- anti-NSFW en modo ARM (Xenova + señales Python)
- stack Python requerido (Pillow, numpy, scipy, cv2, onnxruntime)
- modulos nativos de Node (sharp/canvas)
- creador de stickers y modulos de seguridad

## 4. Cargar perfil de entorno

```bash
source .env.arm
```

## 5. Iniciar el bot

```bash
npm start
```

## 6. Verificacion post-arranque

En otra terminal:

```bash
cd /home/carlos/Documentos/CERBERO-BOT-TERMUX
node --check comandos_cerbero/nsfw_classifier.js
node --check comandos_cerbero/nsfw_detector.js
node --check comandos_cerbero/sticker.js
```

Prueba funcional recomendada dentro de WhatsApp:

1. !bateria nsfw
2. !bateria mixto
3. !sticker con imagen
4. !sticker con video corto

## 7. Si falla onnxruntime

Ejecuta exactamente esto:

```bash
cd /home/carlos/Documentos/CERBERO-BOT-TERMUX
source .venv/bin/activate
python -m pip install --upgrade pip wheel setuptools
python -m pip install -r requirements.txt
python -m pip install --only-binary=:all: onnxruntime
deactivate
npm run arm:setup:full
source .env.arm
npm start
```

## Estado objetivo

Cuando esta bien instalado en Debian proot ARM64:

- anti-NSFW responde sin quedar ciego
- falsos positivos gore se reducen por compuerta hibrida
- stickers funcionan con backend nativo o fallback
- comandos exclusivos del owner y bateria quedan activos

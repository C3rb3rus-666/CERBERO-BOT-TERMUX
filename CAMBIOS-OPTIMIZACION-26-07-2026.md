# 🚀 Optimizaciones CERBERO-BOT — 26 Julio 2026

## 📋 Resumen de Cambios

Se realizaron optimizaciones críticas en ambos repositorios (CERBERO-BOT y CERBERO-BOT-TERMUX) para resolver dos problemas principales:

1. **Recuperar números del bot**: Delays humanizados para evitar detección de actividad intensiva
2. **Anti-NSFW ARM64**: Habilitar Xenova en Termux y eliminar warnings

---

## 🔧 CAMBIOS POR MÓDULO

### 1️⃣ **Tinder & Presentaciones** (presentaciones.js)

#### Antes:
```javascript
const PRESENTATION_GROUP_SEND_DELAY_MS = 900; // 0.9 segundos
```

#### Después:
```javascript
const PRESENTATION_GROUP_SEND_DELAY_MS = 3500; // 3.5 segundos
function getHumanDelay(baseMs) {
  const variance = Math.random() * 1000 - 500; // ±500ms variabilidad
  return Math.max(baseMs + variance, 1000);
}
```

**Impacto**: Delays entre envíos de 3-4 segundos (en lugar de 0.9s)
- ✅ WhatsApp no detecta actividad robótica
- ✅ Procesamiento interno sin bloqueos
- ✅ Variabilidad simula comportamiento humano

---

### 2️⃣ **Confesiones** (confesiones.js)

#### Cambio Similar:
- Delay: 900ms → **3500ms base ± 500ms**
- Función `getHumanDelay()` agregada
- Aplica entre envíos a múltiples grupos

**Archivos actualizados:**
- `/home/carlos/Documentos/CERBERO-BOT/comandos_cerbero/confesiones.js`
- `/home/carlos/Documentos/CERBERO-BOT-TERMUX/comandos_cerbero/confesiones.js`

---

### 3️⃣ **Instagram Callback** (instagram_cb.js)

#### Antes:
```javascript
for (const item of res.data) {
  await sock.sendMessage(...);  // Sin delays
}
```

#### Después:
```javascript
for (let i = 0; i < res.data.length; i++) {
  const item = res.data[i];
  await sock.sendMessage(...);
  if (i < res.data.length - 1) 
    await new Promise(resolve => setTimeout(resolve, 800));
}
```

**Impacto**: Evita enviar múltiples fotos sin delays
- Delays de 800ms entre contenidos
- Evita picos de actividad en descargas

**Archivos:**
- `/home/carlos/Documentos/CERBERO-BOT-TERMUX/comandos_cerbero/instagram_cb.js`

---

## 🔌 Anti-NSFW ARM64 (nsfw_classifier.js)

### ❌ PROBLEMA DETECTADO:
```
⚠️  Xenova desactivado en ARM64 (sin motivo)
⚠️  Letras amarillas en Termux (warnings innecesarios)
❌ Detección NSFW débil en ARM
```

### ✅ SOLUCIÓN IMPLEMENTADA:

#### 1. Archivo `.env.arm64` (CONFIG NUEVA):
```bash
NSFW_FORCE_XENOVA=1          # HABILITA Xenova en ARM64
NSFW_MAX_CONCURRENCY=2       # 1 → 2 (mejor paralelismo)
NSFW_MAX_QUEUE=6             # 4 → 6 (más imágenes en cola)
XENOVA_BACKEND=wasm          # Backend WASM optimizado
ONNX_NUM_THREADS=2           # 1 → 2 threads
NODE_OPTIONS=--max-old-space-size=768  # 512 → 768MB
```

#### 2. Optimizaciones nsfw_classifier.js:
- ✅ Detección automática de ARM64
- ✅ Xenova se habilita por defecto (con opción de forzar)
- ✅ Logs mejorados (sin warnings molestos)
- ✅ Selección automática de modelos (AdamCodd para ARM)
- ✅ Backend WASM estable para ARM64

### Cambio Crítico:
**ANTES:**
```javascript
const DISABLE_XENOVA = ... || (IS_ARM_RUNTIME && !FORCE_XENOVA);
// Resultado: Xenova SIEMPRE deshabilitado en ARM
```

**DESPUÉS:**
```javascript
const XENOVA_ARM_MODE = IS_ARM_RUNTIME && (FORCE_XENOVA || !DISABLE_XENOVA);
// Resultado: Xenova habilitado si FORCE_XENOVA=1 O no está expl. deshabilitado
```

---

## 📊 RESUMEN DE CAMBIOS

| Módulo | Cambio | Beneficio |
|--------|--------|----------|
| Tinder | 900ms → 3500ms ± 500ms | Evita detección de bot |
| Confesiones | 900ms → 3500ms ± 500ms | Evita detección de bot |
| Instagram | Sin delays → 800ms | Evita picos de actividad |
| Anti-NSFW | Xenova: deshabilitado → **habilitado** | Mejor detección en ARM64 |
| TERMUX | Setup ARM64 actualizado | Configuración optimizada |

---

## 🎯 ARCHIVOS MODIFICADOS

### CERBERO-BOT:
- `comandos_cerbero/presentaciones.js` ✅
- `comandos_cerbero/confesiones.js` ✅
- `comandos_cerbero/instagram_cb.js` ✅

### CERBERO-BOT-TERMUX:
- `comandos_cerbero/presentaciones.js` ✅
- `comandos_cerbero/confesiones.js` ✅
- `comandos_cerbero/instagram_cb.js` ✅
- `comandos_cerbero/nsfw_classifier.js` ✅
- `.env.arm64` ✅
- `setup-arm64.sh` ✅

---

## 🚀 CÓMO USAR EN TERMUX

### Opción 1: Script automático (RECOMENDADO)
```bash
cd /home/carlos/Documentos/CERBERO-BOT-TERMUX
./start-arm64.sh
```

### Opción 2: Cargar configuración manualmente
```bash
source setup-arm64.sh
npm ci
npm start
```

### Opción 3: Usar .env.arm64
```bash
cp .env.arm64 .env
npm ci
npm start
```

---

## 📈 RESULTADOS ESPERADOS

✅ **Recuperación de números del bot:**
- Actividad distribuida (3-4s entre envíos)
- WhatsApp no detecta bot-like behavior
- Procesamiento interno sin bloqueos

✅ **Mejor Anti-NSFW en ARM64:**
- Xenova funciona correctamente
- Sin warnings amarillos en Termux
- Detección más precisa

✅ **Performance mejorado:**
- Paralelismo optimizado (2 threads)
- Memoria suficiente (768MB)
- Backend WASM eficiente

---

## 🔍 MONITOREO

Para verificar que los cambios funcionan correctamente:

```bash
# Ver logs de NSFW en tiempo real
tail -f cerbero.log | grep "\[NSFW\]"

# Verificar que Xenova está habilitado (sin warnings)
npm start 2>&1 | grep "NSFW"

# Monitorear delays en confesiones/tinder
tail -f cerbero.log | grep "sleep\|PRESENTATION\|CONF"
```

---

**Actualización:** 26 Julio 2026  
**Versión:** v4.4.19  
**Status:** ✅ Completada

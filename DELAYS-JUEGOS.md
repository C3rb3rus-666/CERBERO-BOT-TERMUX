# 🎮 Optimización de Delays en Juegos — CERBERO-BOT v4.4.19

## 📋 Resumen

Se han añadido **delays estratégicos** a los comandos de juegos para **prevenir la saturación de la API de WhatsApp** y evitar que el bot se caiga por envío excesivo de mensajes.

---

## ⏱️ Delays Implementados

### 1. **Función Helper: `delay(ms)`**
```javascript
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```
- **Ubicación**: Inicio de [gameFIle.js](comandos_cerbero/gameFIle.js)
- **Propósito**: Pausa asincrónica para espaciar envíos de mensajes
- **Uso**: Evitar que múltiples `await sock.sendMessage()` ejecuten simultáneamente

---

## 🎲 Comandos Modificados

### **commandWork (Trabajo)**
```
Delays añadidos:
  ✅ 200ms — Antes de enviar respuesta de cooldown
  ✅ 200ms — Antes de enviar trampa al usuario
  ✅ 300ms — Antes de enviar resultado final del trabajo
```
**Impacto**: Trabajo ejecutado cada 60 segundos sin saturación.

---

### **commandRuleta (Ruleta/Apuestas)**
```
Delays añadidos:
  ✅ 200ms — Validación de apuesta (monto inválido o fondos insuficientes)
  ✅ 300ms — Purga global (si se activa evento 1%)
  ✅ 300ms — Castigo divino (si se activa evento 5%)
  ✅ 300ms — Resultado de ganancia (victoria)
  ✅ 300ms — Resultado de pérdida (derrota)
```
**Impacto**: Ruleta segura incluso con múltiples jugadores simultáneamente.

---

### **commandBlackjack + Subfunciones**
```
Delays añadidos en _bjEnviar() (helper principal):
  ✅ 300ms — ANTES de CADA envío de imagen + caption

Delays en validación:
  ✅ 200ms — Apuesta inválida
  ✅ 200ms — Fondos insuficientes
```
**Impacto**: Blackjack con transiciones suaves (pedir, plantar, doblar, etc).

**Subfunciones afectadas**:
- `commandPedir()` — Pedir carta
- `commandPlantar()` — Plantarse
- `commandDoblar()` — Doblar apuesta
- `commandSplit()` — Dividir mano
- `commandRendirse()` — Rendirse
- `commandSeguro()` — Pedir seguro
- `commandNoSeguro()` — Rechazar seguro
- Y todas las funciones que llaman a `_bjEnviar()`

---

### **commandDaily (Recompensa Diaria)**
```
Delays añadidos:
  ✅ 200ms — Antes de enviar cooldown (ya reclamaste hoy)
  ✅ 200ms — Antes de enviar recompensa exitosa
```
**Impacto**: Daily seguro incluso con muchos jugadores.

---

### **commandRob (Robar)**
```
Delays añadidos:
  ✅ 150ms — Validación (usuario no mencionado)
```
**Impacto**: Validaciones rápidas pero sin saturación.

---

## 📊 Cronograma de Ejecución

### Ejemplo: Uso simultáneo de 5 jugadores haciendo !ruleta

**Sin delays** (ANTES):
```
t=0ms:    Jugador 1 → !ruleta 500 ✅ Mensaje enviado
t=0ms:    Jugador 2 → !ruleta 500 ✅ Mensaje enviado
t=0ms:    Jugador 3 → !ruleta 500 ✅ Mensaje enviado
t=0ms:    Jugador 4 → !ruleta 500 ✅ Mensaje enviado
t=0ms:    Jugador 5 → !ruleta 500 ✅ Mensaje enviado
Result:   ❌ API SATURADA → Bot crash/timeout
```

**Con delays** (DESPUÉS):
```
t=0ms:    Jugador 1 → validar apuesta → delay(200)
t=50ms:   Jugador 2 → validar apuesta → delay(200)
t=100ms:  Jugador 3 → validar apuesta → delay(200)
t=150ms:  Jugador 4 → validar apuesta → delay(200)
t=200ms:  Jugador 5 → validar apuesta → delay(200)
t=200ms:  Jugador 1 → resultado ruleta → delay(300) ✅ Mensaje enviado
t=300ms:  Jugador 2 → resultado ruleta → delay(300) ✅ Mensaje enviado
t=400ms:  Jugador 3 → resultado ruleta → delay(300) ✅ Mensaje enviado
t=500ms:  Jugador 4 → resultado ruleta → delay(300) ✅ Mensaje enviado
t=600ms:  Jugador 5 → resultado ruleta → delay(300) ✅ Mensaje enviado
Result:   ✅ Operación exitosa, sin saturación
```

---

## 🔧 Valores de Delay Utilizados

| Delay | Uso | Razón |
|-------|-----|-------|
| **150ms** | Validaciones rápidas | Permite lectura natural sin percibir lag |
| **200ms** | Errores/cooldowns | Balance entre respuesta rápida y protección |
| **300ms** | Resultados principales | Tiempo suficiente para separar múltiples eventos |

**Total máximo por comando**: ~600-900ms (perceptible pero aceptable en WhatsApp).

---

## 🚀 Beneficios

✅ **Previene crashes** por saturación de API  
✅ **Mejora estabilidad** del bot  
✅ **Experiencia más natural** (no parece instantáneo/sospechoso)  
✅ **Compatible con múltiples usuarios** simultáneamente  
✅ **Reduce rate limiting** de WhatsApp  
✅ **Logging más legible** (eventos separados en el tiempo)  

---

## ⚠️ Efectos Secundarios

❌ Comandos de juego son **~500-700ms más lentos**  
- Aceptable: La mayoría de juegos requieren espera de cooldown  
- Impacto de UX: Mínimo (WhatsApp ya tiene latencia)

---

## 🔍 Testing

### Para verificar que los delays funcionan:

1. **Prueba rápida de comandos**:
```bash
# Terminal 1: Monitorear logs
tail -f cerbero.log | grep -E "Ruleta|Blackjack|Work"

# Terminal 2: Enviar comandos rápidamente
# (Desde WhatsApp)
!work
!ruleta 500
!blackjack 100
!daily
```

2. **Verificar no hay errores de timeout**:
```bash
grep -i "timeout\|error\|crash" cerbero.log
```

3. **Cargar: 5+ jugadores simultáneamente**:
```bash
# En grupo: Pedir a 5 usuarios que ejecuten !ruleta al mismo tiempo
# Verificar: Todos reciben respuesta sin que el bot se caiga
```

---

## 📝 Cambios en Archivos

**Archivo modificado**: `comandos_cerbero/gameFIle.js`

**Funciones modificadas**:
- ✅ `delay(ms)` — Nueva función helper
- ✅ `commandWork()` — 3 delays
- ✅ `commandRuleta()` — 5 delays  
- ✅ `commandBlackjack()` — 2 delays + función helper
- ✅ `_bjEnviar()` — 1 delay en helper (afecta a 14+ funciones)
- ✅ `commandDaily()` — 2 delays
- ✅ `commandRob()` — 1 delay
- ✅ `commandPedir()` — Heredado de `_bjEnviar()`
- ✅ `commandPlantar()` — Heredado de `_bjEnviar()`
- ✅ `commandDoblar()` — Heredado de `_bjEnviar()`
- ✅ Todos los demás subcomandos de blackjack

---

## 🔄 Próximas Optimizaciones (Opcional)

- [ ] Añadir queue de comandos global (limitar concurrencia)
- [ ] Implementar rate limiting por usuario
- [ ] Añadir métricas de saturación
- [ ] Exponential backoff en caso de timeout

---

## 📌 Notas de Mantenimiento

**Si el bot sigue crasheando**:
1. Aumentar delays a 400-500ms
2. Reducir `NSFW_MAX_CONCURRENCY` si se está ejecutando anti-NSFW
3. Limitar comandos simultáneos per grupo

**Si los delays parecen excesivos**:
1. Reducir a 100-150ms
2. Monitorear rate limiting de WhatsApp
3. Ajustar según feedback de usuarios

---

**Build**: 97  
**Versión**: v4.4.19  
**Fecha**: 2026-07-20  
**Archivos**: gameFIle.js

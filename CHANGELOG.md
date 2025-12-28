# Changelog

All notable changes to this project will be documented in this file.

## [4.2.0] - 2025-12-27 (Build 62)
### Added
- `safeSendMessage` wrapper in `index.js` to prevent mass-DMs, rate-limit and redirect replies.
- `utils/messageCounter.js` persistent counters with `incrementCount`, `getCounts`, `setBaseline`, `getCountsSinceBaseline`, `resetCounts`, `getAllChats`, `clearAll`.
- `comandos_cerbero/active_stats.js` command `!actividad` to list active/inactive users with proper mentions.
- `utils/resetScheduler.js` scheduler that backups and resets counters on day 30 of each month.
- `config/always_tag.json` to configure users always mentioned (like `!todos`).

### Changed
- Removed or neutralized `comandos_cerbero/impostor.js` (insecure behavior sending DMs).
- Consolidated SimSimi modules and cleaned duplicate files.
- Logging improvements: display sender number + readable name in `index.js`.
- Version bumped to v4.2.0 Build 62.

### Fixed
- Syntax and robustness fixes in `utils/messageCounter.js`.
- Mentions resolution to avoid raw LID display in activity reports.

### Notes
- The scheduler persists state in `temp/reset_state.json` and backs up counts to `temp/message_counts_backup_YYYYMMDD.json` before clearing.
- To test the scheduler immediately, request `!forcereset` (can be added on demand).


## [4.2.1] - 2025-12-27 (Build 63)
### Fixed
- Evitar pérdida de contadores bajo alta carga: `utils/messageCounter.js` reemplazó la lectura/escritura por operación por un almacén en memoria con flush periódico y escritura atómica.

### Notes
- Se añadió `clearAll` y `getAllChats` para administración y un flush forzado en `beforeExit`.


## [4.2.2] - 2025-12-27 (Build 64)
### Fixed
- `comandos_cerbero/nuevos.js`: Después de etiquetar a los recién llegados, el comando ahora elimina las entradas usadas de `temp/recent_joins.json` para evitar duplicados y liberar espacio.

### Notes
- Actualizada la versión a v4.2.2 Build 64.


## [4.2.4] - 2025-12-28 (Build 67)
### Added
- Sistema de misiones grupales en `comandos_cerbero/gameFIle.js`: Misiones aleatorias asignadas en `!work` enfocadas en interacciones grupales (enviar mensajes, etiquetar miembros, reacciones, stickers, etc.), con verificación semi-automática en comandos.
- Más logros desbloqueables: Primer Trabajo, Ahorrador, Millonario, Nivel 10, Misionero, etc., con recompensas en dinero y XP.
- Campo `totalXP` y `completedMissions` en el JSON de usuarios para tracking avanzado.
- Función `formatMoney()` para formateo consistente de valores en USD con separadores de miles y 2 decimales.
- Eventos de crisis económica (3% probabilidad) que restan 20% del total si supera $50,000.

### Changed
- Moneda del juego cambiada a USD con formateo mejorado (ej. "$1,000.00").
- Reset completo de progreso: Todos los usuarios inician con $1,000, nivel 1, 0 XP, y stats limpios.
- Penalizaciones agresivas para obstáculos: Impuestos aumentados a 10%, atracos a 5% (roban 15%), sin límite visible de dinero.
- Sistema de XP extendido: Más XP en acciones, level up automático (XP >= nivel * 500), y recompensas por niveles.
- Misiones ahora grupales y verificadas internamente en `gameFIle.js` durante comandos en grupo.

### Fixed
- Formateo de números en todos los mensajes para evitar valores disparados y mejorar legibilidad.
- Balance del juego: Obstáculos previenen acumulación excesiva sin tope duro, promoviendo estrategia.

### Notes
- El juego es ahora más enganchador con foco en participación grupal y desafíos progresivos.
- Datos guardados en `./comandos_cerbero/juegos/gameData.json` con nueva estructura (achievements, events, etc.).

- `comandos_cerbero/music_cplay2.js`: añadidos logs y manejo defensivo durante descarga/conversión; ahora registra pasos clave (URL, rutas temporales, errores de ffmpeg).

- `!nuevos` ahora requiere un mensaje personalizado y borra entradas usadas en `temp/recent_joins.json`.
- Mensajes y UX de misiones pulidos.
- Aumentada la versión a `4.2.3` y `build` a `66`.

### Fixed
- Normalizado el formato de salida en `comandos_cerbero/ping.js` para evitar indentación extra y líneas desordenadas en el mensaje de estado (`!ping`).
- `!ping` ahora mide la latencia real (RTT) hacia WhatsApp enviando y eliminando un mensaje de prueba.
- Actualizada la línea de versión en el menú `comandos_cerbero/menu.js` para reflejar **v4.2.3 Build 65**.
- Mejorado `install.sh` para compatibilidad con Arch Linux / Manjaro (pacman): instala `python-pip`, `nodejs`, `npm` y usa `python -m pip` para instalar `yt-dlp`.
- Eliminado el comando `!sopa` (Sopa de Letras) y archivos asociados por decisión del mantenedor.
- `!cplayd` ahora usa `yt-dlp` como fallback si `ytdl-core` falla al extraer firmas (reduce errores: "Could not extract functions").
  - Nota: el fallback usa `python3 -m yt_dlp` o `python -m yt_dlp` si no existe binario `yt-dlp` en PATH; asegúrate de que `yt-dlp` esté instalado (ver `install.sh`).
  - Además, `cplay2` ahora usa la misma lógica de descarga/envío que `cplay` cuando el usuario selecciona una pista: descarga por URL, envía MP3 como audio y documento, y genera una nota de voz OGG (PTT).

### Security/Notes
- Se añadió el evento global "Saqueo del Jefe Maestro" que puede confiscar un 90% de fondos de los jugadores cuando ocurre (probabilidad baja por invocación). Habilitar con precaución y mantener backups.


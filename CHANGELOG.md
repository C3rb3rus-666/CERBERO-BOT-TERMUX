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


## [4.2.3] - 2025-12-27 (Build 65)
### Added
- Sistema de misiones por jugador con recompensas en dinero y XP.
- Nuevos tipos de misión: `buy_item`, `win_battle`, `share_message`, `level_up`, `send_gift`, `participate_event`, `daily_streak`.
- Notificaciones mejoradas al asignar y completar misiones.
- Integración de misiones en flujos: trabajo, depósito, donar, pesca y eventos.
- `!cplay2`: búsqueda en YouTube con previews y selección de descarga.
- Registro y flag de `lealtad` para pruebas en `comandos_cerbero/lealtad.js`.

### Changed
- `!nuevos` ahora requiere un mensaje personalizado y borra entradas usadas en `temp/recent_joins.json`.
- Mensajes y UX de misiones pulidos.
- Aumentada la versión a `4.2.3` y `build` a `65`.

### Fixed
- Normalizado el formato de salida en `comandos_cerbero/ping.js` para evitar indentación extra y líneas desordenadas en el mensaje de estado (`!ping`).
- `!ping` ahora mide la latencia real (RTT) hacia WhatsApp enviando y eliminando un mensaje de prueba.
- Actualizada la línea de versión en el menú `comandos_cerbero/menu.js` para reflejar **v4.2.3 Build 65**.
- Mejorado `install.sh` para compatibilidad con Arch Linux / Manjaro (pacman): instala `python-pip`, `nodejs`, `npm` y usa `python -m pip` para instalar `yt-dlp`.
- Eliminado el comando `!sopa` (Sopa de Letras) y archivos asociados por decisión del mantenedor.
- `!cplayd` ahora usa `yt-dlp` como fallback si `ytdl-core` falla al extraer firmas (reduce errores: "Could not extract functions").
  - Nota: el fallback usa `python3 -m yt_dlp` o `python -m yt_dlp` si no existe binario `yt-dlp` en PATH; asegúrate de que `yt-dlp` esté instalado (ver `install.sh`).

### Security/Notes
- Se añadió el evento global "Saqueo del Jefe Maestro" que puede confiscar un 90% de fondos de los jugadores cuando ocurre (probabilidad baja por invocación). Habilitar con precaución y mantener backups.


# Changelog

All notable changes to this project will be documented in this file.

## [4.2.10] - 2026-01-03 (Build 78)
### Added
- Detección de respuestas y menciones al bot para la IA local (`cerbero_simi.js`): ahora responde cuando se le cita o menciona, con logs de depuración y fallback a Gemini para respuestas dinámicas.
- Función `sendImageWithCaption` en `gameFIle.js` y uso consistente en todos los comandos RPG: el bot envía imágenes definidas (prioridad por prefijos `menu`/`ping`) para todas las respuestas del RPG.

### Changed
- `!todos`: cooldown ahora **2 minutos por usuario** y límite diario **6 usos por usuario**; eliminado el límite de tamaño de grupo. Mensajes informativos actualizados.
- `.gitignore` actualizado para excluir PIDs, caches, datos runtime y carpetas externas (mejora de limpieza del repo).
- Estandarización de handlers RPG a la firma `(sock, message)` y reemplazo de `m.reply` por `sock.sendMessage`/`sendImageWithCaption`.
- `!programador`: ahora prioriza imágenes con prefijos `menu` o `ping` si existen en `comandos_cerbero/imagenes`.
- `!programador`: removida información del sistema en tiempo real; simplificada la presentación manteniendo información del desarrollador, tecnologías y proyectos.
- `!programador`: añadidos enlaces detallados a GitHub, repos (cerbero-bot), Telegram e Instagram.

### Fixed
- Correcciones en la detección y manejo de respuestas/menciones por parte de la IA local; añadidos logs para facilitar depuración.
- Corregida declaración y uso de `participants` en `comandos_cerbero/todos.js` (evita `ReferenceError`).
- Eliminados caracteres especiales y box-drawing en `comandos_cerbero/programador.js` para evitar errores de sintaxis/reportes en VS Code; presentación simplificada sin información de sistema en tiempo real.

---

## [4.2.8] - 2026-01-02 (Build 76)
### Added
- Expansión masiva de base de datos falsa en `!dox` (`comandos_cerbero/dox.js`): Más de 500 opciones variadas incluyendo 70+ ciudades, 50+ ISPs, 35+ OS, 40+ navegadores, 50+ dispositivos, 25+ resoluciones, 32+ zonas horarias, 26+ antivirus, 30+ CPUs/GPUs, 50+ bancos, 20+ plataformas sociales, 45+ trabajos, 30+ grados académicos, 30+ modelos de vehículos, 40+ relaciones familiares, y 46+ países para pasaportes.

### Changed
- `!todos`: cooldown de **2 minutos por usuario** (antes 30 min por grupo), límite diario **6 usos por usuario**, y eliminado el límite de tamaño de grupo.
- IA local: detección de respuestas y menciones al bot; las respuestas ahora se enrutan a `cerbero_simi.js` para respuestas contextuales y aprendizaje local.
- RPG: estandarizados handlers a la firma `(sock, message)` y reemplazadas llamadas de `m.reply` por `await sock.sendMessage(..., { quoted: message })` para mayor compatibilidad con el dispatcher.
- `!dox` (`comandos_cerbero/dox.js`): Añadidos más datos técnicos organizados en secciones (Network, Device, Security, Contact), incluyendo MAC, resolución de pantalla, zona horaria, VPN, firewall, antivirus, CPU, GPU, RAM, almacenamiento y score de leaks. **Ampliado con nuevas secciones**: Financial Info (cuenta bancaria, saldo), Social Media, Professional Info (trabajo, educación), Vehicle Info, Health Info, Family Info, Identification (pasaporte), y detalles adicionales como GPS, código postal y velocidad de conexión. **Expansión masiva de base de datos**: Más de 50 ciudades, 50 ISPs, 35 OS, 40 navegadores, 50 dispositivos, 25 resoluciones, 32 zonas horarias, 26 antivirus, 30 CPUs, 30 GPUs, 50 bancos, 20 plataformas sociales, 45 trabajos, 25 compañías, 30 grados académicos, 25 universidades, 30 marcas de vehículos, 40 relaciones familiares, y 46 países para pasaportes.

### Fixed
- Corregida declaración y uso de `participants` en `comandos_cerbero/todos.js` (evita `ReferenceError` cuando `groupMetadata` no está disponible).
- Corregida declaración duplicada de `participants` que causaba un error de carga en `comandos_cerbero/todos.js`.
- `!leerlog` (`comandos_cerbero/read_log.js`) ahora es **exclusivo** para C3rb3rus-666 (verificación por JID/pushName).

### Notes
- El sistema anti-abuso guarda datos en memoria (se pierden al reiniciar). Si se desea persistencia entre reinicios, se puede añadir almacenamiento en JSON o base de datos.

## [4.2.7] - 2025-12-31 (Build 74)
### Added
- Respuestas por voz en `cerbero_simi.js`: El bot ahora combina respuestas de texto con audio TTS en español (voz masculina), usando google-tts-api para generar archivos temporales que se convierten a OGG con ffmpeg, se envían como mensajes de voz y se eliminan automáticamente para evitar acumulación. Cambiada la librería TTS de gtts a google-tts-api para mejor compatibilidad y voz masculina. Añadida aleatoriedad automática: cada respuesta decide aleatoriamente (50% de probabilidad) si incluir voz o solo texto.
- Nuevos handlers de descarga: `!yt_cb` (YouTube audio), `!yt_cbv` (YouTube video), `!tt_cb`/`!tiktok_cb` (TikTok), `!ig_cb` (Instagram). Basados en la implementación de TheMystic-Bot-MD pero adaptados al estilo y seguridad de Cerbero-BOT. Added dependencies: `cheerio` for TikTok scraping.

### Fixed
- Comando ban: Mejorada la visualización en mensajes, ahora muestra menciones (@usuario) en lugar de números para quien solicita el ban y a quién se banea, facilitando la identificación.
- Monitor de eventos: Mejorado el registro de quién quita admin en eventos de 'demote', agregando más campos posibles para capturar el actor (incluyendo 'from' y 'sender'), y añadido logging para depuración. Cambiado el mensaje por defecto a "un administrador (autor desconocido)" cuando no se puede identificar el actor.
- Monitor de eventos: Corregido error cuando `sock.store` no existe (evita excepciones al resolver nombres), añadidos fallbacks para obtener nombres desde `update` o el JID, y agregado monitoreo para eventos `promote` (nuevo admin).

## [4.2.6] - 2025-12-31 (Build 73)
### Fixed
- Solución completa para la generación de stickers en `comandos_cerbero/sticker.js`:
  - Compatibilidad con `wa-sticker-formatter@^3.x` manejando exportaciones como objeto con `Sticker` y la API basada en `build()` + `get()`.
  - Normalización del buffer resultante (soporte para buffers anidados, base64, y fallback a envío como documento si el envío directo falla).
  - Mejora del pipeline de imágenes: `optimizeImage()` fuerza salida PNG transparente; `optimizeAnimatedMedia()` usa ffmpeg con `libwebp` y `pix_fmt=yuva420p` para preservar transparencia en GIFs/videos.
  - Añadidos logs de depuración temporales y scripts de prueba (`scripts/test-wa-sticker.js`, `scripts/test-create-sticker.js`) para reproducir y verificar la salida.

### Changed
- Actualizada la build a 73 y versión a `4.2.6`.

### Notes
- Esto arregla errores del tipo `Sticker is not a constructor` y las franjas negras en stickers estáticos/animados causadas por rellenos o pérdida de canal alfa.

## [4.2.5] - 2025-12-31 (Build 72)
### Added
- Integración de API de Gemini en `cerbero_simi.js`: Añadida probabilidad del 30% de usar respuestas generadas por Gemini en lugar de respuestas básicas de Simi, aprovechando el prompt de `cerbero_IA.js` para mantener el tono sarcástico y dominante.

### Changed
- Actualizada la build a 72 en `menu.js`, `ping.js`, y `programador.js`.
- Versión actualizada a v4.2.5 en archivos relevantes.

### Notes
- Esto mejora la variedad y dinamismo en respuestas de chat casual, haciendo el bot más impredecible sin perder el estilo agresivo y humorístico.
## [4.2.4] - 2025-12-30 (Build 71)
### Added
- Imágenes aleatorias en comandos principales: `!menu`, `!ping`, `!help`, `!programador`, `!menu2`, y bienvenidas automáticas ahora seleccionan y envían una imagen aleatoria de `comandos_cerbero/imagenes/` (soporta JPG, PNG, GIF, etc.) junto con el texto, en lugar de usar una imagen fija.
- Imágenes aleatorias en comandos del videojuego: `!profile`, `!banco`, `!retiro`, `!depositar`, `!work`, `!daily`, y otros comandos relacionados ahora incluyen una imagen aleatoria para un "sello del bot" visual en cada respuesta.

### Changed
- Penalizaciones más agresivas en el videojuego: Impuestos aumentados de 10% a 20%, atracos de 15% a 25% (probabilidad de 5% a 10%), crisis económica de 20% a 30% (probabilidad de 3% a 5%) para evitar desbalance y acumulación excesiva de dinero.
- Misiones grupales más fáciles de cumplir: Reducidos los targets (ej. enviar mensajes: 2-6 en lugar de 5-15, etiquetar: 1-4 en lugar de 3-10, etc.) para mejor verificación en tiempo real por el bot.
- Presentación del menú mejorada: Cambiada a estilo "Cerbero-OS Terminal" con ASCII art, presumiendo que el bot fue creado en una distro exclusiva llamada Cerbero-OS, para mayor atractivo visual.
- Simplificada la presentación: Quitadas frases pretenciosas como "Distro Exclusiva", "Protocolo: 666", "Elite Dev" para un tono más humilde y directo.
- Actualizada la build a 71 en `menu.js`, `ping.js`, y `programador.js`.
- Reducidas las recompensas máximas de trabajos en el videojuego para evitar acumulación excesiva de dinero (ej. "Hacker para Unknowns" max reducido de 99,899 a 5,000 USD).

### Fixed
- Bug crítico en `gameFIle.js`: El XP y otros datos no se guardaban correctamente debido a que `getUser()` accedía a `gameData[id]` en lugar de `gameData.users[id]`, causando que los usuarios se almacenaran en la raíz del objeto en lugar de en la propiedad `users`. Corregido para usar `gameData.users[id]`.
- Corregidos todos los accesos a `gameData` en funciones como `aplicarIntereses()`, `gananciasPasivas()`, `maybeSaqueoMaestro()`, etc., para usar `gameData.users`.
- Mejorada la función `corregirDatosInvalidos()` para validar y corregir `xp`, `level`, `safe` y otros campos numéricos, previniendo bugs con altas cifras o datos inválidos.
- Asegurado que `loadGameData()` inicialice `gameData.users` si no existe.

### Notes
- Las imágenes se seleccionan aleatoriamente de la carpeta `comandos_cerbero/imagenes/`, filtrando por extensiones válidas. Si no hay imágenes, se envía solo texto como fallback.
- Esto mejora la experiencia visual y consistencia en todas las interacciones del bot.
- El sistema de guardado del videojuego ahora funciona correctamente, permitiendo que XP suba, niveles aumenten y datos persistan entre reinicios.
- Las penalizaciones agresivas y misiones fáciles promueven participación activa sin permitir riquezas excesivas.
- La presentación del menú ahora evoca una interfaz de terminal de "Cerbero-OS", haciendo el bot parecer más avanzado y exclusivo.
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
- Aumentada la versión a `4.2.4` y `build` a `67`.

### Fixed
- Normalizado el formato de salida en `comandos_cerbero/ping.js` para evitar indentación extra y líneas desordenadas en el mensaje de estado (`!ping`).
- `!ping` ahora mide la latencia real (RTT) hacia WhatsApp enviando y eliminando un mensaje de prueba.
- Actualizada la línea de versión en el menú `comandos_cerbero/menu.js` para reflejar **v4.2.4 Build 67**.
- Mejorado `install.sh` para compatibilidad con Arch Linux / Manjaro (pacman): instala `python-pip`, `nodejs`, `npm` y usa `python -m pip` para instalar `yt-dlp`.
- Eliminado el comando `!sopa` (Sopa de Letras) y archivos asociados por decisión del mantenedor.
- `!cplayd` ahora usa `yt-dlp` como fallback si `ytdl-core` falla al extraer firmas (reduce errores: "Could not extract functions").
  - Nota: el fallback usa `python3 -m yt_dlp` o `python -m yt_dlp` si no existe binario `yt-dlp` en PATH; asegúrate de que `yt-dlp` esté instalado (ver `install.sh`).
  - Además, `cplay2` ahora usa la misma lógica de descarga/envío que `cplay` cuando el usuario selecciona una pista: descarga por URL, envía MP3 como audio y documento, y genera una nota de voz OGG (PTT).
- Mejorado el manejo de yt-dlp en `youtubeDownloader.js`: ahora instala automáticamente `yt-dlp` usando pip si no se encuentra en PATH, evitando errores de "yt-dlp not found". Actualizado `package.json` para usar pip en el script de instalación de dependencias.
- Mejorada la detección de yt-dlp en `findYtDlpCommand()`: ahora verifica rutas directas como `~/.local/bin/yt-dlp` y rutas comunes de Python3 si no están en PATH, solucionando problemas cuando la instalación por pip no actualiza el PATH inmediatamente.

### Security/Notes
- Se añadió el evento global "Saqueo del Jefe Maestro" que puede confiscar un 90% de fondos de los jugadores cuando ocurre (probabilidad baja por invocación). Habilitar con precaución y mantener backups.


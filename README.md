# Cerbero-bot

Cerbero-bot es un bot de WhatsApp basado en Baileys, creado por C3rb3rus-666.

Versión: v4.2.3 (Build 65)

Resumen rápido
- Protección global contra envíos masivos y DMs no deseados (`safeSendMessage`) implementada.
- Juego `impostor` eliminado por comportamiento inseguro.
- Contadores persistentes por participante (`utils/messageCounter.js`) con baseline por ingreso a grupos.
- Comando `!actividad` que lista usuarios activos e inactivos (menciones correctas y sin mostrar LID).
- Scheduler mensual que hace backup y resetea contadores el día 30 (`utils/resetScheduler.js`).
- Configuración `config/always_tag.json` para listar usuarios que siempre deben ser etiquetados (como `!todos`).

Instalación

```bash
# instalar dependencias del sistema (opcional)
# o usar el instalador automático (soporta Debian/Ubuntu, Arch/Manjaro, CentOS/RedHat y Termux)
./install.sh

# instalar dependencias de node
npm install

# iniciar
./start.sh
``` 

Notas: El instalador (`install.sh`) ahora detecta y soporta Arch Linux / Manjaro (pacman) e instala `python-pip`, `nodejs` y `npm`, además de `ffmpeg`, `git`, `curl`, y `yt-dlp` usando `python -m pip` para mayor compatibilidad.

Archivos importantes
- `index.js` — punto de entrada y handling principal.
- `comandos_cerbero/` — comandos del bot.
 - `comandos_cerbero/` — comandos del bot.
- `utils/messageCounter.js` — persistencia de contadores por participante.
- `utils/resetScheduler.js` — programador de reseteo mensual.
- `config/always_tag.json` — lista de JIDs que siempre se deben etiquetar.
- `temp/message_counts.json` — archivo persistente con contadores.

Correcciones recientes
- v4.2.1 (Build 63): Se corrigió pérdida de contadores bajo alta carga reimplementando la persistencia:

- v4.2.2 (Build 64): Mejora del comando `!nuevos` — ahora borra las entradas usadas de `temp/recent_joins.json` tras etiquetar a los recién llegados.
 - v4.2.3 (Build 65): Nuevas características y mejoras importantes:
	 - Sistema de misiones por jugador (misiones aleatorias diarias, recompensas en dinero y XP).
	 - Nuevos tipos de misión: compra, victoria en batalla, compartir mensaje, subir de nivel, enviar regalo, participar en eventos y rachas diarias.
	 - Notificaciones mejoradas al asignar y completar misiones (menciones, resumen de recompensas y saldo).
	 - `!cplay2`: flujo de búsqueda en YouTube con previews y selección para descarga; límite de descargas concurrentes por usuario.
	 - `!nuevos` exige ahora un mensaje personalizado y borra las entradas usadas en `temp/recent_joins.json`.
	 - Evento global "Saqueo del Jefe Maestro": probabilidad baja de confiscar 90% de fondos (configurable). Use con precaución.
	 - Flag de `lealtad` añadida para pruebas (`comandos_cerbero/lealtad.js`) y utilidades relacionadas.
	 - **Eliminado** el comando `!sopa` (Sopa de Letras) y archivos asociados por decisión del mantenedor.
	 - **¡Cambio importante!** `!ping` ahora mide la latencia real (RTT) hacia WhatsApp enviando y eliminando un mensaje de prueba.

Notas de uso

- v4.2.1 (Build 63): Se corrigió pérdida de contadores bajo alta carga reimplementando la persistencia:
	- `utils/messageCounter.js` usa ahora un almacén en memoria con flush periódico (1s) y escritura atómica (`.tmp` → rename).
	- Esto reduce I/O por mensaje y evita condiciones de carrera que provocaban conteos inconsistentes.
	- Se añadió flush forzado en `beforeExit` y funciones `clearAll`/`getAllChats` para administración.

Notas de uso
- Añade JIDs a `config/always_tag.json` (ej: ["573001234567@s.whatsapp.net"]) para que el bot los incluya en menciones estilo `!todos`.
- Para probar el reseteo sin esperar al día 30, puedo añadir un comando `!forcereset` bajo petición.
- Para probar el reseteo sin esperar al día 30, puedo añadir un comando `!forcereset` bajo petición.

Notas importantes
- El Saqueo del Jefe Maestro es una acción global y destructiva: se recomienda tener auditoría y backups antes de activarlo en producción.
- La nueva versión incrementa la `build` y cambios en `package.json`. Asegúrate de reiniciar el proceso del bot para cargar módulos ESM actualizados.

Contribuir
- Haz forks y envía PRs. Si quieres que haga commits iniciales aquí, inicializa el repo con `git init`.

Licencia: Apache-2.0

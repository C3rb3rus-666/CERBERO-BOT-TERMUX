# Cerbero-bot

Cerbero-bot es un bot de WhatsApp basado en Baileys, creado por C3rb3rus-666.

 Versión: v4.6.0 (Build 124)

Resumen rápido
 Comando `!dox`: minijuego que genera datos ficticios (IP, ISP, ubicación, email) y etiqueta al objetivo. Es completamente falso y solo para diversión.
 Comando `!arte` / `!art`: envía una de las imágenes que decoran los menús del bot para compartir la estética cerberiana.
Instalación

```bash
cd /home/carlos/Documentos/CERBERO-BOT-TERMUX
bash install.sh
source .env.arm
npm start
```

Instalador unificado:
- `install.sh` instala dependencias del sistema (apt/pacman/apk/dnf/yum/zypper), dependencias Node y ejecuta setup ARM completo.
- Si quieres que el script inicie el bot al final: `bash install.sh --start`

Archivos importantes
- `index.js` — punto de entrada y handling principal.
- `comandos_cerbero/` — comandos del bot.
 - `comandos_cerbero/` — comandos del bot.
- `utils/messageCounter.js` — persistencia de contadores por participante.
- `utils/resetScheduler.js` — programador de reseteo mensual.
- `config/always_tag.json` — lista de JIDs que siempre se deben etiquetar.
- `temp/message_counts.json` — archivo persistente con contadores.

Correcciones recientes
- v4.6.0 (Build 124):
	- Corrección de delay en comandos de juegos: el retardo humano vuelve a ejecutarse correctamente en RPG/casino/minijuegos, evitando ráfagas sin añadir latencias extra globales.
	- Build incrementada a 123 en superficies de UI y metadatos del proyecto.

- v4.6.0 (Build 122):
	- Cola global de comandos (`!`) en `index.js` para serializar ejecución y reducir ráfagas de actividad.
	- Endurecimiento anti-spam en `tinder`, `presentaciones` y `confesiones`: procesamiento silencioso por DM, cola interna y retardo exacto por acción.
	- Bienvenidas anti-oleada: batching por grupo, retardo automático y limitación de menciones en entradas masivas.
	- Administrador autónomo v2: throttling de mensajes automáticos por grupo, cooldowns más largos y mensajes técnicos orientados a telemetría.
- v4.2.15 (Build 87):
	- Identificación híbrida de creador (teléfono + LID) en todos los módulos del bot.
	- Resolución automática LID→teléfono real en logs de consola.
	- Rediseño del log COMMAND INTERCEPTED con estética hacker.
	- Menús (!menu y !menu2) reorganizados y limpiados: secciones consistentes, sin duplicados.
	- Corregidos caracteres Unicode corruptos en killgroup.js.
- v4.2.15 (Build 86):
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
- Añade JIDs a `config/always_tag.json` (ej: ["573001234567@s.whatsapp.net"]) para que el bot los incluya en menciones estilo `!todos`.
- `!todos` ya no tiene cooldown ni límite diario y ahora comparte las mismas imágenes del menú cuando puede enviar medios; además, los mensajes que comienzan con `!` quedan fuera del filtro de antilink para evitar bloqueos involuntarios.
- Para probar el reseteo sin esperar al día 30, puedo añadir un comando `!forcereset` bajo petición.

Notas importantes
- El Saqueo del Jefe Maestro es una acción global y destructiva: se recomienda tener auditoría y backups antes de activarlo en producción.
- La nueva versión incrementa la `build` y cambios en `package.json`. Asegúrate de reiniciar el proceso del bot para cargar módulos ESM actualizados.

Contribuir
- Haz forks y envía PRs. Si quieres que haga commits iniciales aquí, inicializa el repo con `git init`.

Licencia: Apache-2.0

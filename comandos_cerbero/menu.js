import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRandomMenuImagePath } from './art.js';

// Configuración de rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const antilinkConfigPath = path.join(__dirname, '..', 'comandos_cerbero', 'configuraciones', 'antilink_config.json');
const welcomeConfigPath = path.join(__dirname, '..', 'comandos_cerbero', 'configuraciones', 'grupo_ajustado.json');
const monitorConfigPath = path.join(__dirname, '..', 'comandos_cerbero', 'configuraciones', 'monitor_admin_config.json');
const aegisConfigPath  = path.join(__dirname, 'configuraciones', 'antinumbers_config.json');

// Función para seleccionar una imagen aleatoria
export async function menuCommand(sock, msg) {
  const chatId = msg.key.remoteJid;

  // Leer estados de los módulos
  let estados = {
    antilink: '🔴 Desconocido',
    bienvenida: '🔴 Desconocido',
    vigilar: '🔴 Desactivado',
    qrKill: '🟢 Activado (Global)',
    antiTraba: '🟢 Activado (Global)',
    antiSticker: '🟢 Activado (Global)',
    antiGore: '🟢 Activado (Global)',
    aegis: '🟢 Activo (Global)'
  };

  try {
    // Estado del antilink
    const antilinkConfig = JSON.parse(fs.readFileSync(antilinkConfigPath, 'utf8'));
    estados.antilink = antilinkConfig.enabled_groups[chatId] ? '🟢 Activado' : '🔴 Desactivado';

    // Estado de la bienvenida
    const welcomeConfig = JSON.parse(fs.readFileSync(welcomeConfigPath, 'utf8'));
    estados.bienvenida = welcomeConfig[chatId]?.welcome ? '🟢 Activado' : '🔴 Desactivado';

    // Estado del monitor de admins
    const monitorConfig = JSON.parse(fs.readFileSync(monitorConfigPath, 'utf8'));
        estados.vigilar = monitorConfig.enabled_groups[chatId] ? '🟢 Activado' : '🔴 Desactivado';

    // Estado AEGIS — filtro de región
    try {
      const aegisCfg = JSON.parse(fs.readFileSync(aegisConfigPath, 'utf8'));
      const bl = Array.isArray(aegisCfg.blacklist) ? aegisCfg.blacklist.length : 0;
      const wl = Array.isArray(aegisCfg.whitelist) ? aegisCfg.whitelist.length : 0;
      estados.aegis = `🟢 Activo · 🚫${bl} / ✅${wl}`;
    } catch (_) { /* usa valor por defecto */ }

  } catch (error) {
    console.error('Error leyendo configuraciones:', error);
  }

  const menuText = `
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓                             ▓
▓   ⛧  𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓  ⛧        ▓
▓                             ▓
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓

       ⚔️ *v4.4.17 · Build 93* ⚔️
        _Coded by C3rb3rus-666_

  ╔════════════════════════════╗
  ║  🔗 github.com/C3rb3rus-666 ║
  ║  📱 +573233704652          ║
  ║  📷 c3rb3rus_666           ║
  ╚════════════════════════════╝

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  ⚙️ *ESTADO DEL SISTEMA*       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  ▪ Antilink — ${estados.antilink}
  ▪ Bienvenida — ${estados.bienvenida}
  ▪ Vigilar Admins — ${estados.vigilar}
  ▪ QR-KILL — ${estados.qrKill}
  ▪ Anti-TRABA — ${estados.antiTraba}
  ▪ Anti-Sticker — ${estados.antiSticker}
  ▪ Anti-Gore — ${estados.antiGore}
  ▪ AEGIS (Filtro Región) — ${estados.aegis}
  ▪ Anti-Flood — 🟢 Activo (Global)
  ▪ K3RB·0xEY3 (Anti-NSFW) — 🟢 Activo (Global)

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  👑 *OWNER: C3RB3RUS-666*      ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  ⛧ !programador — Ver información del creador
  ⛧ !saquear — Vaciar economía de un usuario
  ⛧ !killgroup — Eliminar grupo completo
  ⛧ !$ — Ejecutar comandos del sistema

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  🤖 *INTELIGENCIA ARTIFICIAL*  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  ▸ !cerbero <texto> — Hablar con IA Local Kerbero
  ▸ !cerbero aprende: P | R — Enseñar respuestas a la IA
  ▸ !simi <texto> — Hablar con SimSimi (online)

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  🔍 *BÚSQUEDA & MULTIMEDIA*    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  ▸ !google <consulta> — Buscar en Google
  ▸ !pin <búsqueda> [1-5] — Buscar imágenes en Pinterest
  ▸ !cplay <búsqueda> — Descargar música MP3
  ▸ !cplay2 <búsqueda> — Buscar música con vista previa
    ↳ !cplayd <número> — Descargar de la lista
  ▸ !cerbero_yt <link> — Descargar video de YouTube
  ▸ !sticker — Convertir imagen/video a sticker
  ▸ !extractor — Extraer imagen de un sticker

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  🎭 *ENTRETENIMIENTO*          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  ▸ !dox — Generar doxxing falso (broma)
  ▸ !arte — Ver galería de imágenes del bot
  ▸ !ping — Ver latencia y estado del bot

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  💔 *RELACIONES*               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  ▸ !parejas — Ver ranking de parejas del grupo
  ▸ !casarme @user — Proponer matrimonio
  ▸ !aceptar — Aceptar propuesta de matrimonio
  ▸ !rechazar — Rechazar propuesta
  ▸ !mipareja — Ver tu pareja actual
  ▸ !divorciarse — Terminar matrimonio
  ▸ !cachudos — Ranking de cornudos 🦌
  ▸ !infieles — Ranking de infieles 👀
  ▸ !maricones — Ranking 🌈
  ▸ !pajeros — Ranking 🍆

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  🎭 *DINÁMICAS DE GRUPO*      ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  ▸ !confesiones [grupo|abrir|cerrar|estado] — Confesiones anónimas
  ▸ !presentaciones [activar|desactivar|estado] — Fotos privadas + encuesta

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  🎮 *MINIJUEGOS*               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  ▸ !adivinapalabra — Adivinar palabra desordenada
  ▸ !ahorcado start — Iniciar juego del ahorcado
  ▸ !ahorcado <letra> — Adivinar letra
  ▸ !minas nuevo [facil|medio|dificil] — Iniciar Buscaminas
  ▸ !minas <A1> — Revelar celda (ej: A3, B5)
  ▸ !minas bandera <A1> — Marcar/desmarcar bandera
  ▸ !htb — Iniciar juego "Hack The Box" (terminal simulado)
  ▸ !htb help — Ver guía rápida de comandos

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  💰 *ECONOMÍA RPG*             ┃
┃  _Sistema unificado de dinero_ ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

📊 *TU PERFIL*
  ▸ !profile — Ver perfil completo (dinero, nivel, stats)
  ▸ !cartera — Ver balance rápido
  ▸ !perfil — Ver perfil detallado

💵 *GANAR DINERO*
  ▸ !work — Trabajar y ganar dinero
  ▸ !daily — Recompensa diaria
  ▸ !trabajar — Trabajo con cooldown (2h)
  ▸ !aventura — Ir de aventura (15 min cooldown)
  ▸ !minar — Minar diamantes (10 min cooldown)
  ▸ !hunt — Cazar animales (gana dinero y XP)
  ▸ !fish — Pescar (requiere caña de pescar)

🏦 *BANCO Y AHORROS*
  ▸ !banco — Ver tu cuenta bancaria
  ▸ !depositar <cantidad> — Guardar dinero en banco
  ▸ !retirar <cantidad> — Sacar dinero del banco
  ▸ !guardar <cantidad> — Guardar en caja fuerte
  ▸ !sacar <cantidad> — Sacar de caja fuerte
  ▸ !caja — Ver caja fuerte

💸 *TRANSFERENCIAS*
  ▸ !donar @user <cantidad> — Enviar dinero a otro
  ▸ !transferir <tipo> <cant> @user — Transferir recursos

🗡️ *ROBO Y CRIMEN*
  ▸ !rob @user — Robar dinero a otro jugador
  ▸ !robar @user — Asaltar (2h cooldown)
  ▸ !robbanco @user — Robar banco (alto riesgo)

🎰 *CASINO*
  ▸ !ruleta <cantidad> — Apostar en la ruleta
  ▸ !blackjack <apuesta> — Jugar blackjack
    ↳ !pedir — Pedir otra carta
    ↳ !plantar — Quedarte con tus cartas
  ▸ !casinostats — Ver estadísticas del casino

💊 *MERCADO NEGRO*
  ▸ !drogas <cantidad> — Comprar/vender drogas
  ▸ !narco <cantidad> — Negocio de narcotráfico

🔞 *ADULTOS*
  ▸ !putas — Contenido premium (gasta dinero)
  ▸ !lujuria — Contenido +18
  ▸ !stalin — Contenido especial

🛒 *TIENDA*
  ▸ !tienda <item> <cant> — Comprar items
  ▸ !buy <item> — Comprar
  ▸ !sell <item> — Vender
  ▸ !inventory — Ver inventario

🏆 *RANKINGS*
  ▸ !top — Ver top jugadores
  ▸ !topricos — Ranking por dinero
  ▸ !lideres — Ranking global
  ▸ !logros — Ver logros desbloqueados

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  🛡️ *ADMINISTRACIÓN*          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  ⚡ !ban @user — Banear usuario del grupo
  ⚡ !kick @user — Expulsar usuario
  ⚡ !promote @user — Dar admin a usuario
  ⚡ !demote @user — Quitar admin a usuario
  ⚡ !antilink [activar|desactivar] — Control de enlaces
  ⚡ !bienvenida [activar|desactivar] — Mensajes de bienvenida
  ⚡ !vigilar [activar|desactivar] — Monitorear cambios de admin
  ⚡ !todos — Etiquetar a todos los miembros
  ⚡ !tag_group — Etiquetar grupo completo
  ⚡ !nuevos <mensaje> — Etiquetar miembros recientes
  ⚡ !admins — Llamar a todos los admins
  ⚡ !actividad — Ver fantasmas y activos
  ⚡ !grupo <abrir|cerrar> — Abrir/cerrar grupo
  ⚡ !bot_join <link> — Invitar bot a otro grupo
  ⚡ !leerlog — Ver registro de links bloqueados
  ⚡ !clear_log — Limpiar registros

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  🤖 *ADMIN AUTÓNOMO · AEGIS*  ┃
┃  _IA que administra el grupo_  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  ⚙ !autonomo activar — Activar IA administradora
  ⚙ !autonomo desactivar — Desactivar IA
  ⚙ !autonomo — Ver estado actual
  ⚙ !autonomo test — Diagnóstico en tiempo real
  ⚙ !autonomo test forzar — Forzar ejecución inmediata

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  🛡️ *CERBERO · AEGIS*         ┃
┃  _Filtro de región automático_ ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  ℹ️ Escanea entradas al grupo y cada 5 min
  ℹ️ Expulsa números de zonas no autorizadas
  ℹ️ Blacklist: bloqueo permanente por número
  ℹ️ Whitelist: números de confianza (nunca expulsados)
  ℹ️ Editar listas: _antinumbers_config.json_

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  💀 *K3RB·0xEY3 · ANTI-NSFW* ┃
┃  _Motor de visión autónomo_    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  ℹ️ Escanea cada imagen enviada al grupo
  ℹ️ 6 señales de análisis pixel en paralelo
  ℹ️ Consenso dual de modelos ML locales
  ℹ️ Elimina imagen + expulsa al infractor
  ℹ️ Siempre activo · Sin configuración manual
  ℹ️ Clasificación: [CLASSIFIED]

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  🌊 *ANTI-FLOOD*              ┃
┃  _Protección ante ataques spam_ ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  ℹ️ Detecta ataques automáticos de spam/comandos
  ℹ️ Ventana: 6s · Límite: 3 cmds / 8 msgs
  ℹ️ Al detectar flood:
      🔒 Cierra el grupo automáticamente
      👢 Expulsa al infractor (si no es admin)
      🔓 Reabre el grupo tras 2 minutos
  ℹ️ Siempre activo, sin configuración manual

▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
     ⛧ C3rb3rus-666 ⛧
  _🤖 ¿Quieres un bot como este? Contáctame_
  _📱 +57 3233704652 · @c3rb3rus_666_
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
`.trim();

  try {
    const randomImagePath = getRandomMenuImagePath();
    if (!randomImagePath) {
      throw new Error('❌ No se encontraron imágenes en la carpeta');
    }

    const imageBuffer = fs.readFileSync(randomImagePath);
    await sock.sendPresenceUpdate('composing', chatId);
    await sock.sendMessage(chatId, {
      image: imageBuffer,
      caption: menuText,
      detectLinks: true,
      contextInfo: {
        mentionedJid: [msg.key.participant || chatId],
        forwardingScore: 999,
        isForwarded: true
      }
    }, { quoted: msg });

  } catch (error) {
    console.error('Error en !menu:', error);
    await sock.sendMessage(chatId, {
      text: `❌ Error al mostrar el menú: ${error.message}`,
      mentions: [msg.key.participant || chatId]
    }, { quoted: msg });
  }
}

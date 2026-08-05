import fs from 'fs';
import chalk from 'chalk';
import path from 'path';
import fsPromises from 'fs/promises';
import { enqueueGlobalCommandTask } from '../utils/global_command_queue.js';

// Configuración de rutas (resueltas contra el directorio de trabajo)
const configPath = path.resolve(process.cwd(), 'comandos_cerbero', 'configuraciones', 'grupo_ajustado.json');
const imagesDir = path.resolve(process.cwd(), 'comandos_cerbero', 'imagenes');
//const stickerPath = './comandos_cerbero/sticker_bienvenida/bienvenida.webp';

// Función para seleccionar una imagen aleatoria
function getRandomImage(imagesDir) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const files = fs.readdirSync(imagesDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return imageExtensions.includes(ext) && fs.statSync(path.join(imagesDir, file)).isFile();
  });
  if (files.length === 0) return null;
  const randomFile = files[Math.floor(Math.random() * files.length)];
  return path.join(imagesDir, randomFile);
} 

// Cargar config
function loadGroupConfig() {
  if (!fs.existsSync(configPath)) {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({}));
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

// Guardar config
function saveGroupConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// ==========================================
// 🛠️ FUNCIÓN AUXILIAR PARA EXTRAER JID
// ==========================================
// Esto soluciona el problema de [object Object]
function getJid(participant) {
    if (typeof participant === 'string') return participant;
    if (participant && participant.id) return participant.id; // Si es objeto con propiedad id
    return String(participant); // Último recurso
}

// Comprueba si la bienvenida está habilitada para un grupo (soporta variantes del id)
function isWelcomeEnabled(config, groupId) {
  if (!config) return false;
  if (config[groupId] && config[groupId].welcome) return true;
  // probar sin sufijo
  const shortId = typeof groupId === 'string' ? groupId.split('@')[0] : groupId;
  if (config[shortId] && config[shortId].welcome) return true;
  // probar variantes comunes
  const altId = `${shortId}@g.us`;
  if (config[altId] && config[altId].welcome) return true;
  return false;
}

// ==========================================
// 🛡️ HANDLER DE BIENVENIDA (FINAL)
// ==========================================
export async function welcomeHandler(sock, update) {
  try {
    const groupId = update && update.id ? update.id : (update && update.jid) ? update.jid : null;
    const groupConfig = loadGroupConfig();

    console.log(chalk.blue(`[WELCOME] trigger groupId=${groupId} participants=${update && update.participants ? update.participants.length : 0}`));

    // 1. Verificar si está activado (soporta varias formas de key)
    if (!groupId || !isWelcomeEnabled(groupConfig, groupId)) {
      console.log(chalk.yellow('[WELCOME] Bienvenida desactivada o groupId inválido'));
      return;
    }

    // 2. Seleccionar imagen aleatoria
    const randomImagePath = getRandomImage(imagesDir);
    if (!randomImagePath) {
      console.log(chalk.bgRed.bold('❌ Error: No se encontraron imágenes en ' + imagesDir));
      return;
    }
    
    const imageBuffer = fs.readFileSync(randomImagePath);
    
    //
    /* Sticker opcional
    let stickerBuffer = null;
    if (fs.existsSync(stickerPath)) {
      stickerBuffer = fs.readFileSync(path.resolve(stickerPath));
    }
    */

    // 🔥 OBTENER JIDS LIMPIOS
    if (!update || !update.participants || !Array.isArray(update.participants) || update.participants.length === 0) {
      console.log(chalk.yellow('[WELCOME] No hay participantes nuevos en el update.'));
      return;
    }
    const newMembersRaw = update.participants;
    // Creamos una lista limpia de JIDs (Textos) para las menciones
    const mentionsArray = newMembersRaw.map(m => getJid(m)).filter(Boolean);

    let groupName = 'este grupo';
    try {
      const groupMetadata = await sock.groupMetadata(groupId);
      if (groupMetadata && groupMetadata.subject) groupName = groupMetadata.subject;
    } catch (err) {
      console.log(chalk.yellow('[WELCOME] No se pudo obtener groupMetadata: ' + (err && err.message ? err.message : err)));
    }

    // 3. Procesar nombres para mostrar en el mensaje
    const newMemberNames = await Promise.all(
      mentionsArray.map(async (jid) => {
        try {
          // Intentamos separar el número del @s.whatsapp.net
          return `@${jid.split('@')[0]}`;
        } catch (error) {
          return '@NuevoMiembro';
        }
      })
    );

    // ==========================================
    // 🎨 FICHA INTEGRADA
    // ==========================================
    const welcomeMessage = `
👋🏽 ¡𝐁𝐢𝐞𝐧𝐯𝐞𝐧𝐢𝐝𝐨/𝐚 𝐚𝐥 𝐠𝐫𝐮𝐩𝐨!
━━━━━━━━━━━━━━━━━━
🏰 *Grupo:* ${groupName}
👥 *Usuario:* ${newMemberNames.join(' ')}
━━━━━━━━━━━━━━━━━━


˙  ꔛ 𝙁𝘪𝘤𝘩𝘢 𝘥𝘦 𝘱𝘳𝘦𝘴𝘦𝘯𝘵𝘢𝘤𝘪𝘰́𝘯  ꔛ ˙

˙  ⌑ ¡   ⃟𝙁𝗈𝗍𝗈 !  ⌑ ˙
˙ ︴⊱
˙  ⌑ ¡   ⃟𝙉𝘰𝘮𝘣𝘳𝘦  !  ⌑ ˙
˙ ︴⊱
˙  ⌑ ¡   ⃟𝙀𝘥𝘢𝘥 !  ⌑ ˙
˙ ︴⊱

🤖 _Coded by 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔_
_¿Quieres un bot como este? 📱 +573233704652 · ✈️ @C3rb3rus_666_
`.trim();

    // 4. Enviar Mensaje + Imagen (encolado para no chocar con admin autónomo)
    const queued = enqueueGlobalCommandTask(async () => {
      await sock.sendMessage(groupId, {
        image: imageBuffer,
        caption: welcomeMessage,
        mentions: mentionsArray, // 👈 Array de JIDs limpios (strings)
      });
    }, { chatId: groupId, command: 'bienvenida_normal' });

    if (!queued.accepted) {
      console.warn(chalk.yellow(`[WELCOME] No se pudo encolar bienvenida normal en ${groupId}`));
      return;
    }

    // Guardar en temp/recent_joins.json para que el comando !nuevos pueda usarlo
    try {
      const recentPath = path.resolve(process.cwd(), 'temp', 'recent_joins.json');
      let recent = {};
      try {
        const raw = await fsPromises.readFile(recentPath, 'utf8');
        recent = JSON.parse(raw || '{}');
      } catch (e) {
        recent = {};
      }
      const now = Date.now();
      recent[groupId] = recent[groupId] || [];
      for (const jid of mentionsArray) {
        recent[groupId].push({ jid, ts: now });
      }
      // keep only last 100 entries per group
      if (recent[groupId].length > 100) recent[groupId] = recent[groupId].slice(-100);
      await fsPromises.mkdir(path.dirname(recentPath), { recursive: true });
      await fsPromises.writeFile(recentPath, JSON.stringify(recent, null, 2), 'utf8');
    } catch (err) {
      console.error('[WELCOME] No se pudo guardar recent_joins:', err && err.message ? err.message : err);
    }

    console.log(chalk.green(`✅ Bienvenida enviada a ${mentionsArray.length} usuario(s) en "${groupName}"`));

    // 5. Enviar Sticker (Si existe)
   /* if (stickerBuffer) {
    //  await sock.sendMessage(groupId, { sticker: stickerBuffer });
    }*/

  } catch (error) {
    console.error(chalk.red('❌ CRASH EN WELCOME:'), error);
  }
}

// Activar/Desactivar
export function toggleWelcome(groupId, enable) {
  const groupConfig = loadGroupConfig();
  if (!groupConfig[groupId]) {
    groupConfig[groupId] = {};
  }
  groupConfig[groupId].welcome = enable;
  saveGroupConfig(groupConfig);
  return enable ? 'Bienvenida activada correctamente' : 'Bienvenida desactivada correctamente';
}
import fs from 'fs';
import { exec } from 'child_process';
import { PythonShell } from 'python-shell';
import path from 'path';

// 🛡️ CONFIGURACIÓN DE PROPIETARIOS (LISTA BLINDADA)
// Agregamos tanto tu número real COMO tu ID de dispositivo (LID) que sale en los logs.
// Así, no importa cómo te identifique WhatsApp, tendrás acceso.
const OWNER_IDS = ['573233704652', '64279084535828']; 

async function executePythonOrShell(sock, message, commandText) {
  // 1. Obtener quién envía el mensaje (puede ser JID o LID)
  const senderRaw = message.key.participant || message.key.remoteJid;
  
  // 2. Limpieza Quirúrgica: Quitamos el @s.whatsapp.net o @lid y posibles puertos (:12)
  const senderNumber = senderRaw.split('@')[0].split(':')[0];

  // 3. Verificación de Seguridad
  if (!OWNER_IDS.includes(senderNumber)) {
    console.log(`[SECURITY] Intento de acceso no autorizado detectado: ${senderNumber}`);
    await sock.sendMessage(message.key.remoteJid, {
      text: '*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ❌ 𝐀𝐂𝐂𝐄𝐒𝐎 𝐃𝐄𝐍𝐄𝐆𝐀𝐃𝐎. 𝐍𝐨 𝐭𝐢𝐞𝐧𝐞𝐬 𝐜𝐫𝐞𝐝𝐞𝐧𝐜𝐢𝐚𝐥𝐞𝐬 𝐑𝐨𝐨𝐭.*'
    }, { quoted: message });
    return;
  }

  if (!commandText) {
    await sock.sendMessage(message.key.remoteJid, {
      text: '*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ❌ Error de Sintaxis. Debes enviar código o un comando.*'
    }, { quoted: message });
    return;
  }

  if (commandText.startsWith('py:')) {
    executePython(commandText.slice(3).trim(), sock, message);
  } else {
    executeShellCommand(commandText, sock, message);
  }
}

// ✅ Función para ejecutar código Python
function executePython(pythonCode, sock, message) {
  if (!pythonCode.trim()) {
    sock.sendMessage(message.key.remoteJid, {
      text: '*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ❌ Código Python vacío.*'
    }, { quoted: message });
    return;
  }

  const tempDir = path.join(process.cwd(), 'temp'); 
  const tempFilePath = path.join(tempDir, `script_${Date.now()}.py`);

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  fs.writeFileSync(tempFilePath, pythonCode);

  const options = {
    args: []
  };
  
  PythonShell.run(tempFilePath, options, async (err, results) => { 
    try {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); 
    } catch(e) {}
  
    if (err) {
      await sock.sendMessage(message.key.remoteJid, {
        text: `*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ❌ Python Error:*\n\`\`\`${err.message}\`\`\``
      }, { quoted: message });
      return;
    }
  
    const output = results && results.length > 0 ? results.join('\n') : '⚠️ (Script ejecutado sin salida)';
    
    await sock.sendMessage(message.key.remoteJid, {
      text: `*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ✅ Python Output:*\n\`\`\`${output}\`\`\``
    }, { quoted: message });
  });
}

// Función para ejecutar comandos de sistema (Shell)
function executeShellCommand(command, sock, message) {
  exec(command, { timeout: 10000 }, async (error, stdout, stderr) => {
    if (error) {
      await sock.sendMessage(message.key.remoteJid, {
        text: `*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ❌ Shell Error:*\n\`\`\`${error.message}\`\`\``
      }, { quoted: message });
      return;
    }

    const output = stdout || stderr || 'Command executed (No output)';
    await sock.sendMessage(message.key.remoteJid, {
      text: `*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ✅ Shell Output:*\n\`\`\`${output.trim()}\`\`\``
    }, { quoted: message });
  });
}

export { executePythonOrShell };
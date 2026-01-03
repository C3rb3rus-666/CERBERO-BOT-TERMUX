import chalk from 'chalk';

// Configuración visual
const paint = {
    bgTitle: chalk.bgHex('#ff0033').black.bold, 
    warn: chalk.hex('#ffae00').bold,           
    info: chalk.hex('#00f2ff'),
    success: chalk.hex('#39ff14').bold
};

// Bandera para pruebas: si es false, la verificación de lealtad se omite
export let LEALTAD_ENABLED = true;

export function setLealtadEnabled(v) {
    LEALTAD_ENABLED = !!v;
}

export async function verificarLealtad(sock, chatId, groupMetadata) {
    if (!LEALTAD_ENABLED) {
        console.log(paint.info(' [LEALTAD] Modo prueba activo: verificación deshabilitada.'));
        return true;
    }
    // 👇 AQUÍ AGREGAMOS TUS DOS IDENTIDADES
    // 1. Tu número real
    // 2. Tu ID de dispositivo (LID) que salió en los logs
    const allowedIds = ['573233704652', '64279084535828']; 

    if (!groupMetadata || !groupMetadata.participants) return true; 

    // ==========================================
    // 🔍 BÚSQUEDA HÍBRIDA (PN + LID)
    // ==========================================
    const creatorIsPresent = groupMetadata.participants.some(participant => {
        // Limpiamos el ID (quitamos @s.whatsapp.net o @lid)
        const cleanId = participant.id.split('@')[0].split(':')[0]; 
        
        // Verificamos si ese ID está en tu lista de permitidos
        return allowedIds.includes(cleanId);
    });

    if (creatorIsPresent) {
        // ✅ CREADOR ENCONTRADO
        // (Opcional: Descomenta esto solo si quieres ver que funciona)
         console.log(paint.success(` ✅ [LEALTAD] Creador detectado en "${groupMetadata.subject}"`));
        return true; 
    } else {
        // ⛔ CREADOR AUSENTE
        const groupName = groupMetadata.subject || 'Grupo Desconocido';
        
        console.log(paint.bgTitle(` ⛔ [SIMULACRO] ALERTA DE LEALTAD: CREADOR NO ESTÁ EN "${groupName}" `));
        console.log(paint.warn('    ⚠️ El bot se habría salido del grupo, pero el código está comentado.'));

        // 👇👇👇 CÓDIGO DE AUTO-EXPULSIÓN (COMENTADO) 👇👇👇
        
        const leaveText = `
⚠️ *[SECURITY PROTOCOL C3rb3rus-666]* ⚠️

🚫 *ACCESO DENEGADO*
No detecto a mi creador (C3rb3rus-666) en este grupo.

🔒 *Directiva de Seguridad:*
El sistema *CERBERO* no puede operar sin supervisión directa.

👋 *Abortando conexión...*
`.trim();

        try {
            // 1. Enviar aviso
            await sock.sendMessage(chatId, { 
                text: leaveText,
                mentions: groupMetadata.participants.map(p => p.id) 
            });

            // 2. Esperar 4 segundos
            await new Promise(r => setTimeout(r, 4000));

            // 3. Salirse del grupo
            await sock.groupLeave(chatId);
            
            console.log(chalk.red(`👋 Bot abandonó el grupo "${groupName}" correctamente.`));
            
            return false; // Detiene el bot

        } catch (error) {
            console.error(chalk.red('Error al intentar salir del grupo:'), error);
        }
        
        
        return true; // Retornamos true mientras sigas probando
    }
}
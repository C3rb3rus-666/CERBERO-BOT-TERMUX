export async function buscarNumerosEnGrupo(sock, message, args) {
  const chatId = message.key.remoteJid;

  // Solo permitir uso del comando desde este grupo específico
  const grupoAutorizadoParaUsarElComando = '120363399979628820@g.us';
  if (chatId !== grupoAutorizadoParaUsarElComando) {
    await sock.sendMessage(chatId, {
      text: '❌ Este comando solo puede usarse desde el grupo autorizado.',
    }, { quoted: message });
    return;
  }

  // Extraer texto del mensaje, incluyendo subtítulos de imágenes
  const rawText =
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    '';

  // Separar líneas y quitar el comando (!buscar)
  const lineas = rawText.split('\n').slice(1).filter(Boolean);

  if (lineas.length === 0) {
    await sock.sendMessage(chatId, {
      text: '⚠️ Debes escribir uno o más números debajo del comando. Ejemplo:\n!buscar\n595 975 784414\n52 56 4835 5530',
    }, { quoted: message });
    return;
  }

  // Normalizar números eliminando todo lo que no sea dígito
  const numerosLimpios = lineas.map(linea =>
    linea.replace(/[^0-9]/g, '')
  ).filter(n => n.length >= 6);

  // Grupo donde se busca (no editable)
  const grupoObjetivoBusqueda = '120363419270240302@g.us';

  try {
    // Obtener los participantes del grupo objetivo
    const metadata = await sock.groupMetadata(grupoObjetivoBusqueda);
    const participantes = metadata.participants.map(p => p.id.replace(/\D/g, ''));

    const encontrados = [];
    const noEncontrados = [];

    for (const numero of numerosLimpios) {
      const esta = participantes.find(p => p.endsWith(numero));
      if (esta) {
        encontrados.push(numero);
      } else {
        noEncontrados.push(numero);
      }
    }

    // Construir respuesta
    let respuesta = '📊 *Resultado de la búsqueda:*\n\n';
    if (encontrados.length > 0) {
      respuesta += '✅ *En el grupo:*\n' + encontrados.map(n => `+${n}`).join('\n') + '\n\n';
    }
    if (noEncontrados.length > 0) {
      respuesta += '❌ *No están en el grupo:*\n' + noEncontrados.map(n => `+${n}`).join('\n');
    }

    await sock.sendMessage(chatId, { text: respuesta.trim() }, { quoted: message });
  } catch (error) {
    console.error('Error al obtener metadata del grupo:', error);
    await sock.sendMessage(chatId, {
      text: '⚠️ No se pudo acceder al grupo de destino para realizar la búsqueda.',
    }, { quoted: message });
  }
}

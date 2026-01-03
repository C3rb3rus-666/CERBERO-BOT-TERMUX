import axios from "axios";

// Prefijo para las respuestas del bot
const BOT_HEADER = "[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬";

// Función para interactuar con la API de SimSimi
const simsimiChat = async (text, language = "es") => {
  try {
    const response = await axios.post(
      "https://api.simsimi.vn/v1/simtalk",
      `text=${encodeURIComponent(text)}&lc=${language}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    // Retorna la respuesta de SimSimi
    return response.data.message || "No pude entender eso. ¿Puedes repetirlo?";
  } catch (error) {
    console.error("Error en la API de SimSimi:", error.message);
    return "¡Ups! Algo salió mal. Inténtalo de nuevo más tarde.";
  }
};

// Función principal del bot
export const simsimiBot = async (sock, msg) => {
  const chatId = msg.key.remoteJid; // ID del chat
  const userJid = msg.key.participant || msg.key.remoteJid; // JID del usuario
  const userMessage = msg.message.conversation || msg.message.extendedTextMessage?.text; // Mensaje del usuario

  if (!userMessage) {
    await sock.sendMessage(chatId, { text: `${BOT_HEADER} Por favor, envía un mensaje de texto.` });
    return;
  }

  // Obtener la respuesta de SimSimi
  const botResponse = await simsimiChat(userMessage, "es");

  // Formatear la respuesta con el prefijo y etiquetar al usuario
  const formattedResponse = `${BOT_HEADER}\n@${userJid.split("@")[0]} ${botResponse}`;

  // Enviar la respuesta al usuario, etiquetándolo
  await sock.sendMessage(
    chatId,
    {
      text: formattedResponse,
      mentions: [userJid], // Etiqueta al usuario
    },
    { quoted: msg } // Responde al mensaje original
  );
};
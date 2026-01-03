import { pipeline } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

// 1. Lista de etiquetas ampliada y optimizada
const ETIQUETAS_VALIDAS = [
  // ====== Animales ======
  "perro", 
  "gato",
  "pájaro",
  "pez",
  "hamster",
  "tortuga",
  "conejo",
  "mono",
  "vaca",
  "caballo",
  "oveja",
  "pato",
  "cerdo",
  "gallina",
  "loro",
  "jirafa",
  "elefante",
  "león",
  "tigre",
  "zorro",

  // ====== Tecnología ======
  // ====== Tecnología (simples y descriptivas) ======
  "celular",
  "computadora",
  "laptop",
  "tablet",
  "teclado",
  "mouse",
  "monitor",
  "smartwatch",
  "dron",
  "consola",
  "auriculares",
  "cargador",
  "router",
  "cámara",
  "micrófono",
  "pantalla táctil",
  "USB",
  "impresora",
  "control de videojuego",
  "altavoz",
  "programacion",
  "hacker",
  "virus",

  "pantalla encendida",
  "pantalla apagada",
  "pantalla azul",
  "persona usando laptop",
  "persona con auriculares",
  "mano tocando pantalla",
  "celular con pantalla rota",
  "niño jugando con tablet",
  "persona escribiendo en teclado",
  "dron en el aire",
  "cámara apuntando",
  "smartwatch en muñeca",
  "router con luces encendidas",
  "consola de videojuegos encendida",
  "monitor con fondo oscuro",
  "persona grabando con micrófono",
  "persona sosteniendo un USB",
  "cable USB conectado",
  "impresora imprimiendo",
  "pantalla con código",
  "pantalla con videollamada",
  "pantalla con videojuego",
  "pantalla con redes sociales",
  "teclado retroiluminado",
  "persona jugando videojuegos",
  "estación de trabajo tecnológica",


  // ====== WhatsApp ======
  "chat de WhatsApp",
  "sticker",
  "videollamada",
  "captura de pantalla",
  "foto de perfil",
  "mensaje de voz",
  "notificación",
  "estado de WhatsApp",
  "meme",
  "imagen reenviada",
  "emojis",
  "pantalla rota",
  "código QR",
  "llamada perdida",
  "mensaje fijado",
  "grabación de pantalla",
  "reacción de emoji",
  "grupo de WhatsApp",
  "mensaje eliminado",
  "fondo de chat",
  "mensaje marcado como importante",
  "mensaje con reacciones",
  "llamada entrante de WhatsApp",
  "foto grupal de perfil",
  "burbuja de mensaje verde",
  "burbuja de mensaje gris",
  "doble check azul",
  "doble check gris",
  "mensaje reenviado",
  "mensaje citado",
  "mensaje largo",
  "audio pausado",
  "teclado en pantalla",
  "mensaje con archivo adjunto",
  "mensaje con ubicación",
  "mensaje con contacto",
  "nombre de contacto",
  "hora del mensaje",
  "pantalla de bloqueo con notificación de WhatsApp",
    // ====== WhatsApp (nuevas añadidas) ======
  "icono de WhatsApp",
  "notificación flotante de WhatsApp",
  "estado con texto",
  "estado con foto",
  "estado con video",
  "estado silenciado",
  "estado visto",
  "emoji grande en mensaje",
  "barra de progreso de audio",
  "barra de carga de video",
  "mensaje con gif",
  "pantalla de llamada saliente",
  "foto desenfocada de perfil",
  "sticker animado",
  "nueva conversación",
  "mensaje editado",
  "chat archivado",
  "buscador de chats",
  "fondo oscuro de WhatsApp",
  "modo claro de WhatsApp",


  // ====== Personas ======
  "persona",
  "hombre",
  "mujer",
  "niño",
  "niña",
  "selfie",
  "grupo de personas",
  "bebé",
  "anciano",
  "rostro",
  "persona con gafas",
  "persona sonriendo",
  "persona corriendo",
  "persona comiendo",
  "persona durmiendo",
  "persona leyendo",
  "persona hablando por teléfono",
  "persona con mascarilla",
  "persona llorando",
  "persona riendo",

  // ====== Objetos cotidianos ======
  "café",
  "libro",
  "llaves",
  "zapatos",
  "reloj",
  "mochila",
  "auto",
  "bicicleta",
  "silla",
  "mesa",
  "control remoto",
  "ventilador",
  "televisor",
  "botella",
  "espejo",
  "vaso",
  "sombrero",
  "bolso",
  "pañuelo",
  "plato",

  // ====== Lugares ======
  "playa",
  "ciudad",
  "parque",
  "casa",
  "restaurante",
  "hospital",
  "escuela",
  "montaña",
  "bosque",
  "oficina",
  "supermercado",
  "calle",
  "aeropuerto",
  "iglesia",
  "mercado",
  "puente",
  "carretera",
  "edificio",
  "estación de tren",
  "centro comercial",

  // ====== Descriptivas ======
  "persona usando celular",
  "gato durmiendo",
  "niño jugando con pelota",
  "grupo en videollamada",
  "café sobre la mesa",
  "playa al atardecer",
  "ciudad de noche",
  "auto estacionado",
  "pareja abrazándose",
  "persona frente a computadora",
  "foto desenfocada",
  "emoji sonriente",
  "dron volando",
  "selfie en espejo",
  "llaves en el suelo",
  "niña en bicicleta",
  "pareja caminando por la playa",
  "niño con mochila escolar",
  "persona cocinando",
  "persona mirando por la ventana"
];


// 2. Función para cargar el clasificador CLIP (sin cambios)
let clasificador = null;
async function cargarClasificador() {
  if (!clasificador) {
    try {
      clasificador = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
      console.log('Modelo cargado exitosamente');
    } catch (error) {
      console.error('Error crítico al cargar el modelo:', error);
      throw new Error('No se pudo cargar el modelo CLIP');
    }
  }
  return clasificador;
}

// 3. Función principal (sin cambios, pero ahora con más etiquetas)
export const analizarImagenAuto = async (sock, msg) => {
  if (!msg.message?.imageMessage) return;

  try {
    // Descargar imagen
    const buffer = await downloadMediaMessage(msg, 'buffer');
    const tempPath = path.join('./temp', `img_${Date.now()}.jpg`);
    
    // Asegurar directorio temporal
    if (!fs.existsSync('./temp')) fs.mkdirSync('./temp', { recursive: true });
    fs.writeFileSync(tempPath, buffer);

    // Cargar clasificador CLIP
    const clasificador = await cargarClasificador();
    
    // Procesar imagen con el clasificador CLIP
    const resultado = await clasificador(tempPath, ETIQUETAS_VALIDAS);

    // Limpiar archivo temporal
    fs.unlinkSync(tempPath);

    // Formatear los resultados
    const top3 = resultado.slice(0, 3)
      .map(item => `• ${item.label} (${(item.score * 100).toFixed(1)}%)`)
      .join('\n');

    // Enviar los resultados al usuario
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: `🔍 *Análisis de imagen:*\n\n${top3}\n\n_Modelo: CLIP-ViT-Base-Patch32_` },
      { quoted: msg }
    );

  } catch (error) {
    console.error('[ERROR] Procesamiento de imagen:', error);
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: '⚠️ Error al analizar la imagen. Intente con otra imagen más clara.' },
      { quoted: msg }
    );
  }
};


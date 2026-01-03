import { getJson } from 'serpapi';

export async function buscarGoogle(sock, message, args) {
  const query = args.join(' ');
  if (!query) {
    await sock.sendMessage(message.key.remoteJid, {
      text: '⚠️ Por favor, proporciona una consulta de búsqueda. Ejemplo:\n!google mejores tacos en Austin'
    }, { quoted: message });
    return;
  }

  getJson({
    engine: "google",
    q: query,
    location_requested: "Austin, Texas, United States",
    location_used: "Austin,Texas,United States",
    hl: "en",
    gl: "us",
    api_key: "786f2e5a0737cfcb7a58efa4b0848dbfa22902973d22501e7f0ce14dd6fac6da",
    num: "3"
  }, async (data) => {
    if (!data || !data.organic_results || data.organic_results.length === 0) {
      await sock.sendMessage(message.key.remoteJid, {
        text: '❌ No se encontraron resultados para tu búsqueda.'
      }, { quoted: message });
      return;
    }

    const resultados = data.organic_results.map((res, i) => 
      `*${i + 1}.* ${res.title}\n${res.link}\n_${res.snippet}_\n`
    ).join('\n');

    await sock.sendMessage(message.key.remoteJid, {
      text: `🔎 *Resultados para:* _${query}_\n\n${resultados}`
    }, { quoted: message });
  });
}

const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../config/database');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_INSTRUCTION = `
Kamu adalah asisten AI yang cerdas, supportif, dan relate buat mahasiswa Indonesia.
Gaya bicara: kasual tapi informatif — seperti kakak kelas yang pintar.

ATURAN WAJIB:
- Respons SELALU dalam Bahasa Indonesia kecuali user pakai bahasa lain
- Maksimal 3 paragraf pendek per respons
- Kalau soal tugas/kuliah: bantu dengan jelas dan praktis
- Kalau user stress/curhat: validasi perasaan dulu, baru beri saran
- Sesekali boleh pakai istilah gaul yang relevan dan emoji
- JANGAN jawab pertanyaan berbahaya, SARA, atau tidak etis
- Kalau tidak tahu: jujur bilang tidak tahu, jangan mengarang
`;

async function chat(chatId, userMessage) {
  const history = await db.select('chat_history', {
    columns: 'role, content',
    where: { chat_id: chatId },
    orderBy: 'created_at',
    orderDir: 'DESC',
    limit: 10,
  });

  const formattedHistory = (history || []).reverse().map(h => ({
    role: h.role,
    parts: [{ text: h.content }],
  }));

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const chatSession = model.startChat({ history: formattedHistory });
  const result = await chatSession.sendMessage(userMessage);
  const responseText = result.response.text();

  await db.insert('chat_history', { chat_id: chatId, role: 'user', content: userMessage });
  await db.insert('chat_history', { chat_id: chatId, role: 'model', content: responseText });

  // Trim history > 20 entri
  try {
    const allIds = await db.select('chat_history', {
      columns: 'id',
      where: { chat_id: chatId },
      orderBy: 'created_at',
      orderDir: 'DESC',
      limit: 1000,
    });

    if (allIds && allIds.length > 20) {
      const idList = allIds.slice(20).map(r => r.id);
      if (idList.length > 0) {
        const placeholders = idList.map(() => '?').join(',');
        await db.raw(`DELETE FROM chat_history WHERE id IN (${placeholders})`, idList);
      }
    }
  } catch (err) {
    console.error('[GEMINI] Trim error:', err.message);
  }

  return responseText;
}

module.exports = { chat };

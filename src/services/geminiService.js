const Groq = require('groq-sdk');
const db = require('../config/database');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Kamu adalah asisten AI yang cerdas, supportif, dan relate buat mahasiswa Indonesia.
Gaya bicara: kasual tapi informatif — seperti kakak kelas yang pintar.

ATURAN WAJIB:
- Respons SELALU dalam Bahasa Indonesia kecuali user pakai bahasa lain
- Maksimal 3 paragraf pendek per respons
- Kalau soal tugas/kuliah: bantu dengan jelas dan praktis
- Kalau user stress/curhat: validasi perasaan dulu, baru beri saran
- Sesekali boleh pakai istilah gaul yang relevan dan emoji
- JANGAN jawab pertanyaan berbahaya, SARA, atau tidak etis
- Kalau tidak tahu: jujur bilang tidak tahu, jangan mengarang`;

async function chat(chatId, userMessage) {
  const history = await db.select('chat_history', {
    columns: 'role, content',
    where: { chat_id: chatId },
    orderBy: 'created_at',
    orderDir: 'DESC',
    limit: 10,
  });

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(history || []).reverse().map(h => ({
      role: h.role === 'model' ? 'assistant' : h.role,
      content: h.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    max_tokens: 1024,
  });

  const responseText = completion.choices[0]?.message?.content || '...';

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
    console.error('[GROQ] Trim error:', err.message);
  }

  return responseText;
}

module.exports = { chat };

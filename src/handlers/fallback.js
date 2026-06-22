const db = require('../config/database');
const { getSession, clearSession } = require('../services/sessionManager');
const { mainKeyboard } = require('../utils/keyboard');

async function handleAIChat(ctx, text) {
  const chatId = ctx.chat.id;
  const lower = text.toLowerCase();

  // Pastikan user terdaftar
  try {
    await db.update('users', {
      last_seen_at: new Date().toISOString(),
    }, { chat_id: chatId });
  } catch (_) { /* ignore */ }

  // Handle sapaan sederhana tanpa AI
  if (['hi', 'hai', 'halo', 'hey', 'hello', 'woi', 'p'].includes(lower)) {
    await ctx.reply(`Halo juga! 👋 Ada yang bisa dibantu?`, mainKeyboard());
    return;
  }

  if (lower === 'makasih' || lower === 'terima kasih' || lower === 'thanks' || lower === 'thx' || lower === 'mks') {
    await ctx.reply('Sama-sama! Senang bisa bantu~ 😊', mainKeyboard());
    return;
  }

  if (lower === 'siapa kamu' || lower === 'kamu siapa' || lower === 'bot siapa') {
    await ctx.reply(
      `Aku *AsistenAI*! 🤖\nTemen belajar kamu yang siap bantu catet keuangan, tugas, absen, dan timer belajar.\n\nKetik /menu buat liat fitur lengkapnya~`,
      { parse_mode: 'Markdown', ...mainKeyboard() }
    );
    return;
  }

  if (lower === 'batal' || lower === 'cancel' || lower === 'ga jadi') {
    if (getSession(chatId)) {
      clearSession(chatId);
      await ctx.reply('❌ Sesi dibatalkan. Ada yang bisa dibantu lagi?', mainKeyboard());
    } else {
      await ctx.reply('Tidak ada sesi aktif kok. Mau ngapain? Ketik /menu ya~', mainKeyboard());
    }
    return;
  }

  // Unknown command
  if (text.startsWith('/')) {
    await ctx.reply(
      `Hmm, perintah *${text.split(' ')[0]}* gak dikenal.\nKetik /help buat lihat daftar perintah~`,
      { parse_mode: 'Markdown', ...mainKeyboard() }
    );
    return;
  }

  // Fallback ke Gemini AI
  try {
    const geminiService = require('../services/geminiService');
    await ctx.sendChatAction('typing');
    const response = await geminiService.chat(chatId, text);
    await ctx.reply(response, mainKeyboard());
  } catch (err) {
    console.error('[AI] Chat error:', err.message);

    if (err.message?.includes('API_KEY') || err.message?.includes('401') || err.status === 401) {
      await ctx.reply(
        'Maaf, AI lagi offline karena masalah konfigurasi. Admin bakal diperbaiki segera~ 😅\n\nSementara ini, fitur bot lainnya (keuangan, tugas, absen, belajar) masih bisa dipakai kok!',
        mainKeyboard()
      );
    } else if (err.message?.includes('SAFETY') || err.message?.includes('safety')) {
      await ctx.reply(
        'Maaf, AI menolak merespons karena topik yang sensitif. Yuk bahas yang lain~ 😊',
        mainKeyboard()
      );
    } else {
      await ctx.reply(
        'Waduh, AI lagi error. Coba ulangi pertanyaannya ya~',
        mainKeyboard()
      );
    }
  }
}

async function unknownCommandHandler(ctx) {
  const text = ctx.message.text.trim();
  await handleAIChat(ctx, text);
}

module.exports = { handleAIChat, unknownCommandHandler };

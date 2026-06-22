require('dotenv').config();

const { Telegraf } = require('telegraf');
const express = require('express');
const moment = require('moment-timezone');
const db = require('./config/database');
const { getSession, clearSession, setNotifyTimeout, getActiveSessionsCount } = require('./services/sessionManager');
const { initNotifEngine } = require('./services/notifEngine');
const { errorHandler } = require('./middlewares/errorHandler');
const { mainKeyboard } = require('./utils/keyboard');
const { startHandler, menuHandler, helpHandler } = require('./handlers/start');
const { keuanganHandler, keuanganCallbackHandler, keuanganTextHandler } = require('./handlers/keuangan');
const { tugasHandler, tugasCallbackHandler, tugasTextHandler, daftarTugasHandler, selesaiTugasHandler } = require('./handlers/tugas');
const { absenHandler, absenCallbackHandler, absenTextHandler, lihatJadwalHandler, matikanAbsenHandler, hidupkanAbsenHandler } = require('./handlers/absen');
const { belajarHandler, belajarCallbackHandler, belajarTextHandler } = require('./handlers/belajar');
const { rekapHandler, rekapCallbackHandler } = require('./handlers/rekap');
const { handleAIChat } = require('./handlers/fallback');

// ============================================================
// GLOBAL CRASH PROTECTION
// ============================================================
process.on('uncaughtException', (err) => {
  console.error('[CRASH PREVENTED]', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[REJECTION]', reason);
});

// ============================================================
// BOT INIT
// ============================================================
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('[FATAL] BOT_TOKEN tidak ditemukan di environment!');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN, {
  telegram: { webhookReply: false },
});

// ============================================================
// SESSION TIMEOUT NOTIFIER
// ============================================================
setNotifyTimeout(async (chatId) => {
  try {
    await bot.telegram.sendMessage(
      chatId,
      '⏰ Sesi habis. Silakan ketik perintah kembali.',
      mainKeyboard()
    );
  } catch (_) { /* user may have blocked bot */ }
});

// ============================================================
// COMMANDS
// ============================================================
bot.start(startHandler);
bot.command('menu', menuHandler);
bot.command('help', helpHandler);
bot.command('batal', async (ctx) => {
  const chatId = ctx.chat.id;
  if (getSession(chatId)) {
    clearSession(chatId);
    await ctx.reply('❌ Sesi dibatalkan. Ada yang bisa dibantu lagi?', mainKeyboard());
  } else {
    await ctx.reply('Tidak ada sesi aktif kok. Mau ngapain? Ketik /menu ya~', mainKeyboard());
  }
});

// Keuangan
bot.command('keuangan', keuanganHandler);

// Tugas
bot.command('tugas', tugasHandler);
bot.command('daftartugas', daftarTugasHandler);
bot.command('selesai', selesaiTugasHandler);

// Absen
bot.command('absen', absenHandler);
bot.command('lihatjadwal', lihatJadwalHandler);
bot.command('matikanabsen', matikanAbsenHandler);
bot.command('hidupkanabsen', hidupkanAbsenHandler);

// Belajar
bot.command('belajar', belajarHandler);

// Rekap
bot.command('rekap', rekapHandler);

// ============================================================
// CALLBACK QUERY HANDLER (InlineKeyboard)
// ============================================================
bot.on('callback_query', async (ctx) => {
  const chatId = ctx.chat.id;
  const data = ctx.callbackQuery.data;

  // Route berdasarkan prefix callback_data
  if (data.startsWith('trans_') || data === 'confirm_no' || data === 'confirm_edit' || data === 'confirm_yes') {
    // Cek apakah session mengarah ke keuangan
    const session = getSession(chatId);
    if (session && session.state?.startsWith('keuangan')) {
      await keuanganCallbackHandler(ctx);
      return;
    }
  }

  if (data.startsWith('prio_') || data.startsWith('tugas:')) {
    await tugasCallbackHandler(ctx);
    return;
  }

  if (data.startsWith('study_') || data.startsWith('subject_')) {
    await belajarCallbackHandler(ctx);
    return;
  }

  if (data.startsWith('rekap_')) {
    await rekapCallbackHandler(ctx);
    return;
  }

  // Generic callback routing by session state
  const session = getSession(chatId);
  if (!session) {
    await ctx.answerCbQuery('Sesi sudah habis. Ketik perintah dari awal ya~');
    return;
  }

  if (session.state?.startsWith('keuangan')) {
    await keuanganCallbackHandler(ctx);
  } else if (session.state?.startsWith('tugas')) {
    await tugasCallbackHandler(ctx);
  } else if (session.state?.startsWith('absen')) {
    await absenCallbackHandler(ctx);
  } else if (session.state?.startsWith('belajar')) {
    await belajarCallbackHandler(ctx);
  } else {
    await ctx.answerCbQuery();
  }
});

// ============================================================
// TEXT MESSAGE HANDLER
// ============================================================
bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();

  // Handle button label replies
  switch (text) {
    case '📊 Keuangan':
      await keuanganHandler(ctx);
      return;
    case '📚 Tugas':
      await tugasHandler(ctx);
      return;
    case '⏰ Absen':
      await absenHandler(ctx);
      return;
    case '🧠 Belajar':
      await belajarHandler(ctx);
      return;
    case '📈 Rekap':
      await rekapHandler(ctx);
      return;
    case '❓ Bantuan':
      await helpHandler(ctx);
      return;
  }

  // Route to active session text handlers
  const session = getSession(chatId);

  if (session) {
    // Try each handler in order
    if (await keuanganTextHandler(ctx, text)) return;
    if (await tugasTextHandler(ctx, text)) return;
    if (await absenTextHandler(ctx, text)) return;
    if (await belajarTextHandler(ctx, text)) return;

    // Session state exists but no handler matched — reset
    clearSession(chatId);
  }

  // Fallback ke AI chat
  await handleAIChat(ctx, text);
});

// ============================================================
// ERROR MIDDLEWARE
// ============================================================
bot.catch((err, ctx) => {
  errorHandler(err, ctx);
});

// ============================================================
// EXPRESS KEEP-ALIVE SERVER
// ============================================================
const app = express();

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime_seconds: Math.round(process.uptime()),
    timestamp: moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss [WIB]'),
    sessions_active: getActiveSessionsCount(),
    memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  });
});

app.get('/', (req, res) => {
  res.send('Telegram Bot Assistant is running.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[EXPRESS] Health check server running on port ${PORT}`);
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================
async function shutdown(signal) {
  console.log(`[SHUTDOWN] Received ${signal} — closing gracefully...`);
  try {
    await bot.stop();
  } catch (_) {}
  console.log('[SHUTDOWN] Bot stopped.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================================
// START BOT
// ============================================================
(async () => {
  try {
    await db.raw('SELECT 1 AS check_connection');
    console.log('[DB] Supabase connected successfully');
  } catch (err) {
    console.error('[DB] Connection error:', err.message);
  }

  try {
    // Start notification engine
    initNotifEngine(bot);

    // Launch bot (long polling untuk Render free tier)
    await bot.launch({
      polling: {
        allowed_updates: ['message', 'callback_query'],
      },
    });
    console.log('[BOT] Telegram bot started successfully');
  } catch (err) {
    console.error('[FATAL] Bot failed to start:', err.message);
    process.exit(1);
  }
})();

require('dotenv').config();

const { Telegraf } = require('telegraf');
const { getSession, clearSession, setNotifyTimeout } = require('./services/sessionManager');
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

bot.command('keuangan', keuanganHandler);
bot.command('tugas', tugasHandler);
bot.command('daftartugas', daftarTugasHandler);
bot.command('selesai', selesaiTugasHandler);
bot.command('absen', absenHandler);
bot.command('lihatjadwal', lihatJadwalHandler);
bot.command('matikanabsen', matikanAbsenHandler);
bot.command('hidupkanabsen', hidupkanAbsenHandler);
bot.command('belajar', belajarHandler);
bot.command('rekap', rekapHandler);

// ============================================================
// CALLBACK QUERY HANDLER
// ============================================================
bot.on('callback_query', async (ctx) => {
  const chatId = ctx.chat.id;
  const data = ctx.callbackQuery.data;

  if (data.startsWith('trans_') || data === 'confirm_no' || data === 'confirm_edit' || data === 'confirm_yes') {
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

  switch (text) {
    case '📊 Keuangan': await keuanganHandler(ctx); return;
    case '📚 Tugas':    await tugasHandler(ctx); return;
    case '⏰ Absen':    await absenHandler(ctx); return;
    case '🧠 Belajar':  await belajarHandler(ctx); return;
    case '📈 Rekap':    await rekapHandler(ctx); return;
    case '❓ Bantuan':  await helpHandler(ctx); return;
  }

  const session = getSession(chatId);
  if (session) {
    if (await keuanganTextHandler(ctx, text)) return;
    if (await tugasTextHandler(ctx, text)) return;
    if (await absenTextHandler(ctx, text)) return;
    if (await belajarTextHandler(ctx, text)) return;
    clearSession(chatId);
  }

  await handleAIChat(ctx, text);
});

// ============================================================
// ERROR MIDDLEWARE
// ============================================================
bot.catch((err, ctx) => {
  errorHandler(err, ctx);
});

// ============================================================
// NOTIF ENGINE (only init in long-running env)
// ============================================================
function startNotifEngine() {
  initNotifEngine(bot);
}

module.exports = { bot, startNotifEngine, BOT_TOKEN };

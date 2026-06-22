const { mainKeyboard } = require('../utils/keyboard');

async function errorHandler(err, ctx) {
  console.error('[ERROR]', err.message, '| chat:', ctx?.chat?.id);

  // Telegraf-specific errors
  if (err.code === 400) {
    // Bad request — biasanya callback query kadaluarsa
    try {
      await ctx.answerCbQuery?.('Tombol sudah kedaluwarsa, ketik ulang perintahnya~');
    } catch (_) { /* ignore */ }
    return;
  }

  if (err.code === 403) {
    // Bot diblokir user — silent ignore
    return;
  }

  if (err.code === 429) {
    // Rate limited — kasih tahu user
    try {
      await ctx.reply?.(
        'Pelan-pelan ya, bot lagi kewalahan 😅 Tunggu 5 detik.',
        mainKeyboard()
      );
    } catch (_) { /* ignore */ }
    return;
  }

  // Network / timeout errors
  if (err.message?.includes('ECONNRESET') || err.message?.includes('timeout') || err.message?.includes('ETIMEDOUT')) {
    console.error('[NETWORK] Connection error:', err.message);
    try {
      await ctx.reply?.(
        'Koneksi lagi bermasalah. Retry otomatis... Coba ulangi perintahnya ya~',
        mainKeyboard()
      );
    } catch (_) { /* ignore */ }
    return;
  }

  // Database errors
  if (err.message?.includes('mysql') || err.message?.includes('database') || err.message?.includes('db')) {
    try {
      await ctx.reply?.(
        'Waduh, ada gangguan teknis di database. Coba lagi dalam 1 menit ya.',
        mainKeyboard()
      );
    } catch (_) { /* ignore */ }
    return;
  }

  // Generic fallback
  try {
    await ctx.reply?.(
      'Maaf, terjadi kesalahan. Coba ulangi perintahnya ya~ 🙏',
      mainKeyboard()
    );
  } catch (_) { /* ignore */ }
}

module.exports = { errorHandler };

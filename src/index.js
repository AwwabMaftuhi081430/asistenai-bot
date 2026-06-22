const express = require('express');
const moment = require('moment-timezone');
const { bot } = require('./bot');
const { initNotifEngine } = require('./services/notifEngine');
const db = require('./config/database');
const { getActiveSessionsCount } = require('./services/sessionManager');

// ============================================================
// EXPRESS HEALTH CHECK
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

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================
async function shutdown(signal) {
  console.log(`[SHUTDOWN] Received ${signal} — closing gracefully...`);
  try { await bot.stop(); } catch (_) {}
  console.log('[SHUTDOWN] Bot stopped.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================================
// START
// ============================================================
(async () => {
  try {
    await db.raw('SELECT 1 AS check_connection');
    console.log('[DB] Supabase connected successfully');
  } catch (err) {
    console.error('[DB] Connection error:', err.message);
  }

  initNotifEngine(bot);

  try {
    await bot.launch({
      polling: { allowed_updates: ['message', 'callback_query'] },
    });
    console.log('[BOT] Telegram bot started successfully');
  } catch (err) {
    console.error('[FATAL] Bot failed to start:', err.message);
    process.exit(1);
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[EXPRESS] Health check server running on port ${PORT}`);
  });
})();

const express = require('express');
const moment = require('moment-timezone');
const { bot } = require('./bot');
const { initNotifEngine } = require('./services/notifEngine');
const db = require('./config/database');
const { getActiveSessionsCount } = require('./services/sessionManager');

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

async function shutdown(signal) {
  console.log(`[SHUTDOWN] Received ${signal} — closing gracefully...`);
  try { await bot.stop(); } catch (_) {}
  console.log('[SHUTDOWN] Bot stopped.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Only run when executed directly (not when imported as module in serverless)
if (require.main === module) {
  (async () => {
    try {
      const sb = db.getSb();
      await sb.from('users').select('chat_id', { count: 'exact', head: true }).limit(1);
      console.log('[DB] Supabase connected successfully');
    } catch (err) {
      console.error('[DB] Connection error:', err.message);
    }

    try {
      await bot.launch({
        polling: { allowed_updates: ['message', 'callback_query'] },
      });
      console.log('[BOT] Telegram bot started successfully');

      initNotifEngine(bot);

      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => {
        console.log(`[EXPRESS] Health check server running on port ${PORT}`);
      });
    } catch (err) {
      console.error('[FATAL] Bot failed to start:', err.message);
      process.exit(1);
    }
  })();
}

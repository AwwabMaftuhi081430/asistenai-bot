let bot = null;

function getBot() {
  if (bot) return bot;

  const { Telegraf } = require('telegraf');
  const token = process.env.BOT_TOKEN;

  if (!token) {
    throw new Error('BOT_TOKEN not set');
  }

  bot = new Telegraf(token, {
    telegram: { webhookReply: true },
  });

  // Register handlers
  require('../src/bot').registerHandlers(bot);

  return bot;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(200).send('🤖 Telegram bot webhook aktif.');
      return;
    }

    const b = getBot();
    await b.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error('[WEBHOOK] Error:', err.message, err.stack);
    res.status(200).send('OK');
  }
};

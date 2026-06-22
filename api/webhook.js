const { bot } = require('../src/bot');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(200).send('🤖 Telegram bot webhook aktif.');
      return;
    }

    await bot.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error('[WEBHOOK] Error:', err.message);
    res.status(200).send('OK');
  }
};

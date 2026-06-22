const { bot } = require('../src/bot');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).send('🤖 Telegram bot webhook aktif.');
    return;
  }

  try {
    await bot.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error('[WEBHOOK] Error:', err.message);
    // Always return 200 so Telegram doesn't keep retrying
    res.status(200).send('OK');
  }
};

const { bot } = require('../src/bot');
const { setBot, checkReminders, checkDeadlineTasks } = require('../src/services/notifEngine');
const moment = require('moment-timezone');

setBot(bot);

module.exports = async function handler(req, res) {
  try {
    await checkReminders();

    const nowWIB = moment().tz('Asia/Jakarta');
    if (nowWIB.format('HH:mm') === '08:00') {
      await checkDeadlineTasks();
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[CRON] Error:', err.message);
    res.status(200).json({ ok: false, error: err.message });
  }
};

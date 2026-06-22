const cron = require('node-cron');
const moment = require('moment-timezone');
const db = require('../config/database');

let bot = null;

function setBot(botInstance) {
  bot = botInstance;
}

function initNotifEngine(botInstance) {
  setBot(botInstance);

  // Cron setiap 60 detik — cek reminders yang harus dikirim
  cron.schedule('* * * * *', async () => {
    await checkReminders();
  });

  // Cron harian jam 08:00 WIB — reminder tugas deadline besok
  cron.schedule('0 8 * * *', async () => {
    await checkDeadlineTasks();
  }, { timezone: 'Asia/Jakarta' });

  console.log('[NOTIF] Notification engine started');
}

// Map index hari JS (0=Minggu) ke nama kolom DB
const DAY_COLUMNS = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

async function checkReminders() {
  if (!bot) return;

  const nowWIB = moment().tz('Asia/Jakarta');
  const currTime = nowWIB.format('HH:mm');
  const today = nowWIB.format('YYYY-MM-DD');
  const todayCol = DAY_COLUMNS[nowWIB.day()]; // kolom hari ini

  // Ambil user yang:
  // 1. is_active = true
  // 2. Kolom hari ini = jam sekarang
  // 3. Belum dapat notif hari ini (anti-duplikat)
  try {
    const reminders = await db.raw(
      `SELECT chat_id, ${todayCol} FROM reminders WHERE is_active = true AND ${todayCol} = ? AND (last_sent_at IS NULL OR last_sent_at != ?)`,
      [currTime, today]
    );

    for (const r of reminders ?? []) {
      await sendReminder(r.chat_id, currTime, today, todayCol);
    }
  } catch (err) {
    console.error('[NOTIF] checkReminders error:', err.message);
  }
}

async function sendReminder(chatId, currTime, today, todayCol) {
  try {
    await bot.telegram.sendMessage(
      chatId,
      `🚨 *WAKTU ABSEN KULIAH!* 🚨\n\n` +
      `Halo! Udah jam *${currTime} WIB* nih.\n` +
      `Jangan keasyikan nge-game dulu, yuk absen sekarang! 🎮➡️📋\n\n` +
      `_Absen dulu baru rank up!_ 😄`,
      { parse_mode: 'Markdown' }
    );

    await db.update('reminders', {
      last_sent_at: today,
      updated_at: new Date().toISOString(),
    }, { chat_id: chatId });

    await db.insert('notifications_log', {
      chat_id: chatId,
      type: 'absen_reminder',
      message: `[${todayCol}] Reminder at ${currTime} WIB`,
      status: 'sent',
    });

  } catch (err) {
    if (err.response?.error_code === 403) {
      await db.update('reminders', { is_active: false }, { chat_id: chatId });
      console.log(`[NOTIF] User ${chatId} blocked bot — disabled.`);
    } else {
      console.error(`[NOTIF] Failed for ${chatId}:`, err.message);
    }
  }
}

async function checkDeadlineTasks() {
  if (!bot) return;

  const nowWIB = moment().tz('Asia/Jakarta');
  const tomorrow = nowWIB.clone().add(1, 'day').format('YYYY-MM-DD');

  try {
    const tasks = await db.select('tasks', {
      columns: 'id, chat_id, name, deadline, priority',
      where: { deadline: tomorrow, is_done: false },
    });

    // Group tasks by chat_id
    const grouped = {};
    for (const task of tasks || []) {
      if (!grouped[task.chat_id]) grouped[task.chat_id] = [];
      grouped[task.chat_id].push(task);
    }

    for (const [chatId, taskList] of Object.entries(grouped)) {
      const names = taskList.map(t => `• _${t.name}_`).join('\n');
      try {
        await bot.telegram.sendMessage(
          parseInt(chatId),
          `⚠️ *Besok deadline!* ⚠️\n\n` +
          `Tugas berikut harus dikumpul besok:\n${names}\n\n` +
          `Udah siap? Semangat! 💪`,
          { parse_mode: 'Markdown' }
        );

        await db.insert('notifications_log', {
          chat_id: parseInt(chatId),
          type: 'deadline_reminder',
          message: `Deadline reminder: ${taskList.length} tasks due ${tomorrow}`,
          status: 'sent',
        });
      } catch (err) {
        if (err.response?.error_code === 403) {
          console.log(`[NOTIF] User ${chatId} blocked bot — skip deadline reminder.`);
        }
      }
    }
  } catch (err) {
    console.error('[NOTIF] checkDeadlineTasks error:', err.message);
  }
}

function stopAll() {
  // node-cron doesn't have a stopAll, we'd need to track individual tasks
  console.log('[NOTIF] Cron jobs stopping at next cycle.');
}

module.exports = { initNotifEngine, setBot, checkReminders, checkDeadlineTasks, stopAll };

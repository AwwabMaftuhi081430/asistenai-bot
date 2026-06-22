const db = require('../config/database');
const { setSession, getSession, clearSession } = require('../services/sessionManager');
const { validateTaskName, validateDeadline, validatePriority } = require('../utils/validators');
const { formatTaskDeadline, formatDaysRemaining, priorityLabel, priorityEmoji } = require('../utils/formatters');
const { mainKeyboard, confirmKeyboard, confirmDeleteKeyboard, priorityKeyboard } = require('../utils/keyboard');
const moment = require('moment-timezone');

async function tugasHandler(ctx) {
  const chatId = ctx.chat.id;

  setSession(chatId, 'tugas:nama', {});
  await ctx.reply('Nama tugas atau mata kuliahnya apa?');
}

async function tugasCallbackHandler(ctx) {
  const chatId = ctx.chat.id;
  const data = ctx.callbackQuery.data;
  const session = getSession(chatId);

  if (!session) {
    await ctx.answerCbQuery('Sesi sudah habis. Ketik /tugas lagi ya~');
    return;
  }

  // Handle deadline_past confirm/edit/no BEFORE general confirm handlers
  if (session.state === 'tugas:deadline_past') {
    if (data === 'confirm_yes') {
      setSession(chatId, 'tugas:prioritas', { ...session.data });
      await ctx.editMessageText('Prioritas tugas ini?', priorityKeyboard());
      await ctx.answerCbQuery();
    } else if (data === 'confirm_edit') {
      setSession(chatId, 'tugas:deadline', session.data);
      await ctx.editMessageText('Tenggat waktunya kapan? (Format: DD-MM-YYYY, contoh: 25-06-2026)');
      await ctx.answerCbQuery();
    } else if (data === 'confirm_no') {
      clearSession(chatId);
      await ctx.editMessageText('❌ Dibatalkan ya.');
      await ctx.answerCbQuery();
    }
    return;
  }

  if (data === 'confirm_no') {
    clearSession(chatId);
    await ctx.editMessageText('❌ Dibatalkan ya. Ada yang bisa dibantu lagi?');
    await ctx.answerCbQuery();
    return;
  }

  if (data === 'confirm_edit') {
    clearSession(chatId);
    await ctx.editMessageText('Oke, ulang dari awal~');
    await tugasHandler(ctx);
    return;
  }

  if (session.state === 'tugas:prioritas') {
    if (data.startsWith('prio_')) {
      const prio = data.replace('prio_', '');
      if (validatePriority(prio)) {
        setSession(chatId, 'tugas:confirm', {
          ...session.data,
          priority: prio,
        });

        const d = { ...session.data, priority: prio };
        const deadlineMoment = moment(d.deadline, 'YYYY-MM-DD');
        const daysLeft = formatDaysRemaining(d.deadline);

        await ctx.editMessageText(
          `📋 *Ringkasan Tugas*\n\n` +
          `Nama     : _${d.name}_\n` +
          `Deadline : ${formatTaskDeadline(d.deadline)} (${daysLeft})\n` +
          `Prioritas: ${priorityLabel(prio)}\n\n` +
          `Udah bener?`,
          { parse_mode: 'Markdown', ...confirmKeyboard() }
        );
        await ctx.answerCbQuery();
      }
    } else {
      await ctx.answerCbQuery('Pilih prioritas dulu ya~');
    }
    return;
  }

  if (session.state === 'tugas:confirm') {
    if (data === 'confirm_yes') {
      await saveTugas(ctx, session);
    }
    return;
  }

  await ctx.answerCbQuery();
}

async function tugasTextHandler(ctx, text) {
  const chatId = ctx.chat.id;
  const session = getSession(chatId);

  if (!session) return false;

  if (session.state === 'tugas:nama') {
    const validation = validateTaskName(text);
    if (!validation.valid) {
      await ctx.reply(validation.reason);
      return true;
    }

    setSession(chatId, 'tugas:deadline', { name: validation.value });
    await ctx.reply('Tenggat waktunya kapan? (Format: DD-MM-YYYY, contoh: 25-06-2026)');
    return true;
  }

  if (session.state === 'tugas:deadline') {
    const validation = validateDeadline(text);
    if (!validation.valid) {
      await ctx.reply(validation.reason);
      return true;
    }

    // Cek apakah deadline sudah lewat
    if (validation.isPast) {
      setSession(chatId, 'tugas:deadline_past', {
        ...session.data,
        deadline: validation.value,
      });
      await ctx.reply(
        `⚠️ Tanggal *${text}* itu sudah lewat nih. Tetap disimpan?`,
        { parse_mode: 'Markdown', ...confirmDeleteKeyboard() }
      );
      return true;
    }

    setSession(chatId, 'tugas:prioritas', {
      ...session.data,
      deadline: validation.value,
    });
    await ctx.reply('Prioritas tugas ini?', priorityKeyboard());
    return true;
  }

  return false;
}

async function saveTugas(ctx, session) {
  const chatId = ctx.chat.id;
  const { name, deadline, priority } = session.data;

  try {
    await db.insert('tasks', {
      chat_id: chatId,
      name,
      deadline,
      priority,
    });

    const daysLeft = formatDaysRemaining(deadline);
    const prioLbl = priorityLabel(priority);

    clearSession(chatId);
    await ctx.editMessageText(
      `✅ *Tugas disimpan!*\n\n` +
      `📚 _${name}_\n` +
      `📅 Deadline: ${formatTaskDeadline(deadline)} (sisa *${daysLeft}*)\n` +
      `${prioLbl}\n\n` +
      `Semangat, bisa dikerjain nih! 💪`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('[TUGAS] Save error:', err.message);
    await ctx.editMessageText('Waduh, gagal nyimpen tugas. Coba lagi ya~');
    clearSession(chatId);
  }
}

async function daftarTugasHandler(ctx) {
  const chatId = ctx.chat.id;

  try {
    const tasks = await db.select('tasks', {
      where: { chat_id: chatId, is_done: false },
      orderBy: 'deadline',
      orderDir: 'ASC',
    });

    if (!tasks || tasks.length === 0) {
      await ctx.reply('✅ Gaada tugas aktif nih. Santai dulu~', mainKeyboard());
      return;
    }

    const nowWIB = moment().tz('Asia/Jakarta');
    const lines = tasks.map(t => {
      const daysLeft = formatDaysRemaining(t.deadline);
      return `${priorityEmoji(t.priority)} [${t.id}] _${t.name}_ — ${daysLeft}`;
    });

    await ctx.reply(
      `📚 *TUGAS AKTIF (${tasks.length})*\n\n${lines.join('\n')}\n\n` +
      `Ketik /selesai [id] kalau udah selesai ya~`,
      { parse_mode: 'Markdown', ...mainKeyboard() }
    );
  } catch (err) {
    console.error('[DAFTARTUGAS] Error:', err.message);
    await ctx.reply('Waduh, gagal ambil data tugas. Coba lagi ya~');
  }
}

async function selesaiTugasHandler(ctx) {
  const chatId = ctx.chat.id;
  const args = ctx.message.text.trim().split(/\s+/);
  const taskId = parseInt(args[1]);

  if (!taskId || isNaN(taskId)) {
    await ctx.reply('Format: /selesai [id tugas]. Contoh: /selesai 3');
    return;
  }

  try {
    const task = await db.select('tasks', {
      where: { id: taskId, chat_id: chatId },
      single: true,
    });

    if (!task) {
      await ctx.reply('Tugas dengan ID itu gak ditemukan. Cek /daftartugas ya~');
      return;
    }

    await db.update('tasks', { is_done: true }, { id: taskId });
    await ctx.reply(`✅ Tugas *_${task.name}_* udah selesai! Keren! 🎉`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[SELESAI] Error:', err.message);
    await ctx.reply('Waduh, gagal update tugas. Coba lagi ya~');
  }
}

module.exports = {
  tugasHandler,
  tugasCallbackHandler,
  tugasTextHandler,
  daftarTugasHandler,
  selesaiTugasHandler,
};

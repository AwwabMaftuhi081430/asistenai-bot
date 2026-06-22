const db = require('../config/database');
const { setSession, getSession, clearSession } = require('../services/sessionManager');
const { validateReminderTime } = require('../utils/validators');
const { mainKeyboard, confirmKeyboard } = require('../utils/keyboard');

const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const DAY_COLUMNS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];

async function absenHandler(ctx) {
  const chatId = ctx.chat.id;

  setSession(chatId, 'absen:input', {
    jadwal: [null, null, null, null, null, null, null],
    dayIndex: 0,
  });

  await ctx.reply(
    '📅 Atur jadwal reminder absen!\n\n' +
    'Ketik jam untuk setiap hari (contoh: 07:15) atau ketik *skip* jika hari itu libur/tidak perlu reminder.\n\n' +
    `*Hari ${HARI[0]}:*`,
    { parse_mode: 'Markdown' }
  );
}

async function absenTextHandler(ctx, text) {
  const chatId = ctx.chat.id;
  const session = getSession(chatId);

  if (!session) return false;

  if (session.state === 'absen:input') {
    const dayIndex = session.data.dayIndex;
    const jadwal = [...session.data.jadwal];
    const lower = text.trim().toLowerCase();

    if (lower === 'skip') {
      jadwal[dayIndex] = null;
    } else {
      const validation = validateReminderTime(text.trim());
      if (!validation.valid) {
        await ctx.reply(
          'Format salah. Ketik jam seperti *07:15* atau ketik *skip*.',
          { parse_mode: 'Markdown' }
        );
        return true;
      }
      jadwal[dayIndex] = validation.value;
    }

    const nextIndex = dayIndex + 1;

    if (nextIndex >= 7) {
      setSession(chatId, 'absen:confirm', { jadwal });
      await sendSummary(ctx, jadwal);
    } else {
      setSession(chatId, 'absen:input', { jadwal, dayIndex: nextIndex });
      await ctx.reply(`*Hari ${HARI[nextIndex]}:*`, { parse_mode: 'Markdown' });
    }
    return true;
  }

  return false;
}

function formatJadwalTable(jadwal) {
  const lines = HARI.map((hari, i) => {
    const val = jadwal[i];
    const displayStr = val === null ? 'skip' : val;
    const content = ` ${hari.padEnd(7)}: ${displayStr}`;
    return `│${content.padEnd(26)}│`;
  });

  return (
    '```\n' +
    '┌──────────────────────────┐\n' +
    '│ 📅 JADWAL REMINDER ABSEN │\n' +
    lines.join('\n') + '\n' +
    '└──────────────────────────┘\n' +
    '```'
  );
}

async function sendSummary(ctx, jadwal) {
  await ctx.reply(formatJadwalTable(jadwal), {
    parse_mode: 'Markdown',
    ...confirmKeyboard(),
  });
}

async function absenCallbackHandler(ctx) {
  const chatId = ctx.chat.id;
  const data = ctx.callbackQuery.data;
  const session = getSession(chatId);

  if (!session) {
    await ctx.answerCbQuery('Sesi sudah habis. Ketik /absen lagi ya~');
    return;
  }

  if (data === 'confirm_no') {
    clearSession(chatId);
    await ctx.editMessageText('❌ Dibatalkan ya.');
    await ctx.answerCbQuery();
    return;
  }

  if (data === 'confirm_edit') {
    clearSession(chatId);
    await ctx.editMessageText('Oke, ulang dari awal~');
    await absenHandler(ctx);
    return;
  }

  if (data === 'confirm_yes') {
    await saveReminder(ctx, session);
    return;
  }

  await ctx.answerCbQuery();
}

async function saveReminder(ctx, session) {
  const chatId = ctx.chat.id;
  const { jadwal } = session.data;

  try {
    const payload = {
      chat_id: chatId,
      is_active: true,
      last_sent_at: null,
      updated_at: new Date().toISOString(),
    };

    DAY_COLUMNS.forEach((col, i) => {
      payload[col] = jadwal[i];
    });

    await db.upsert('reminders', payload, 'chat_id');

    const activeDays = jadwal.filter(v => v !== null).length;
    clearSession(chatId);

    await ctx.editMessageText(
      `⏰ *Jadwal reminder disimpan!*\n\n` +
      `Kamu akan diingatkan *${activeDays} hari* dalam seminggu sesuai jadwal di atas.\n` +
      `Hari yang di-*skip* tidak akan dapat notif.\n\n` +
      `Mau ubah? Ketik /absen lagi.\n` +
      `Lihat jadwal: /lihatjadwal`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('[ABSEN] Save error:', err.message);
    await ctx.editMessageText('Waduh, gagal nyimpen. Coba lagi ya~');
    clearSession(chatId);
  }
}

async function lihatJadwalHandler(ctx) {
  const chatId = ctx.chat.id;

  try {
    const reminder = await db.select('reminders', {
      where: { chat_id: chatId },
      single: true,
    });

    if (!reminder) {
      await ctx.reply('Belum ada jadwal reminder. Ketik /absen untuk atur~', mainKeyboard());
      return;
    }

    const dataArr = DAY_COLUMNS.map(col => reminder[col]);
    const status = reminder.is_active ? '✅ Aktif' : '❌ Nonaktif';

    // Build table tanpa markdown code block untuk status
    const table = formatJadwalTable(dataArr);
    const statusLine = `Status: ${status.padEnd(21)}`;

    await ctx.reply(table + '\n' + statusLine, {
      parse_mode: 'Markdown',
      ...mainKeyboard(),
    });
  } catch (err) {
    console.error('[LIHATJADWAL] Error:', err.message);
    await ctx.reply('Waduh, gagal ambil data. Coba lagi ya~');
  }
}

async function matikanAbsenHandler(ctx) {
  const chatId = ctx.chat.id;

  try {
    await db.update('reminders', {
      is_active: false,
      updated_at: new Date().toISOString(),
    }, { chat_id: chatId });

    await ctx.reply('⏰ Pengingat absen udah *dimatikan*.', { parse_mode: 'Markdown', ...mainKeyboard() });
  } catch (err) {
    console.error('[MATIKANABSEN] Error:', err.message);
    await ctx.reply('Waduh, gagal. Coba lagi ya~');
  }
}

async function hidupkanAbsenHandler(ctx) {
  const chatId = ctx.chat.id;

  try {
    await db.update('reminders', {
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { chat_id: chatId });

    await ctx.reply('⏰ Pengingat absen udah *diaktifkan* lagi!', { parse_mode: 'Markdown', ...mainKeyboard() });
  } catch (err) {
    console.error('[HIDUPKANABSEN] Error:', err.message);
    await ctx.reply('Waduh, gagal. Coba lagi ya~');
  }
}

module.exports = {
  absenHandler,
  absenCallbackHandler,
  absenTextHandler,
  lihatJadwalHandler,
  matikanAbsenHandler,
  hidupkanAbsenHandler,
};

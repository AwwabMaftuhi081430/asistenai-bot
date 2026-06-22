const db = require('../config/database');
const { setSession, getSession, clearSession } = require('../services/sessionManager');
const { validateSubject } = require('../utils/validators');
const { formatTime, formatDuration, formatDateTime } = require('../utils/formatters');
const { mainKeyboard, studyStartKeyboard, studySubjectKeyboard, studyEndKeyboard, studyCrashKeyboard } = require('../utils/keyboard');
const moment = require('moment-timezone');

async function belajarHandler(ctx) {
  const chatId = ctx.chat.id;

  try {
    const activeSession = await db.select('study_logs', {
      where: { chat_id: chatId, is_active: true },
      orderBy: 'start_time',
      orderDir: 'DESC',
      single: true,
    });

    if (!activeSession) {
      await ctx.reply('Mau mulai sesi belajar?', studyStartKeyboard());
      return;
    }

    const startMoment = moment(activeSession.start_time).tz('Asia/Jakarta');
    const nowWIB = moment().tz('Asia/Jakarta');
    const diffHours = nowWIB.diff(startMoment, 'hours');

    if (diffHours >= 12) {
      setSession(chatId, 'belajar:crash', { sessionId: activeSession.id, session: activeSession });
      await ctx.reply(
        `⚠️ Ada sesi yang kelihatannya belum ditutup sejak ${formatDateTime(activeSession.start_time)}.\n` +
        `Mau dihitung sampai sekarang atau diabaikan?`,
        studyCrashKeyboard()
      );
      return;
    }

    const elapsedMinutes = nowWIB.diff(startMoment, 'minutes');
    setSession(chatId, 'belajar:aktif', { sessionId: activeSession.id, session: activeSession });

    await ctx.reply(
      `🧠 Kamu sedang belajar _${activeSession.subject}_ sejak ${formatTime(activeSession.start_time)} (*${formatDuration(elapsedMinutes)}*).\n` +
      `Sudah selesai?`,
      { parse_mode: 'Markdown', ...studyEndKeyboard() }
    );

  } catch (err) {
    console.error('[BELAJAR] Error:', err.message);
    await ctx.reply('Waduh, ada gangguan. Coba lagi ya~');
  }
}

async function belajarCallbackHandler(ctx) {
  const chatId = ctx.chat.id;
  const data = ctx.callbackQuery.data;
  const session = getSession(chatId);

  if (data === 'confirm_no') {
    clearSession(chatId);
    await ctx.editMessageText('Oke, lain kali aja~');
    await ctx.answerCbQuery();
    return;
  }

  // Mulai sesi baru — minta subjek
  if (data === 'study_start') {
    await ctx.editMessageText('Mau belajar apa hari ini?', studySubjectKeyboard());
    await ctx.answerCbQuery();
    return;
  }

  // Pilih subjek
  if (data.startsWith('subject_')) {
    const subject = data.replace('subject_', '');
    if (subject === 'lainnya') {
      setSession(chatId, 'belajar:subjek_input', {});
      await ctx.editMessageText('Tulis subjek belajarnya ya~');
      await ctx.answerCbQuery();
      return;
    }

    await startStudySession(ctx, chatId, subject);
    return;
  }

  // Sesi aktif — selesai
  if (data === 'study_end') {
    await endStudySession(ctx, chatId, session);
    return;
  }

  // Sesi aktif — pause (tutup sesi tanpa menampilkan statistik detail)
  if (data === 'study_pause') {
    await endStudySession(ctx, chatId, session, true);
    return;
  }

  // Batalkan sesi
  if (data === 'study_cancel') {
    await cancelStudySession(ctx, chatId, session);
    return;
  }

  await ctx.answerCbQuery();
}

async function belajarTextHandler(ctx, text) {
  const chatId = ctx.chat.id;
  const session = getSession(chatId);

  if (!session) return false;

  if (session.state === 'belajar:subjek_input') {
    const validation = validateSubject(text);
    if (!validation.valid) {
      await ctx.reply(validation.reason);
      return true;
    }

    await startStudySession(ctx, chatId, validation.value);
    return true;
  }

  return false;
}

async function startStudySession(ctx, chatId, subject) {
  try {
    const nowWIB = moment().tz('Asia/Jakarta').toISOString();

    await db.insert('study_logs', {
      chat_id: chatId,
      subject,
      start_time: nowWIB,
      is_active: true,
    });

    clearSession(chatId);
    await ctx.editMessageText(
      `🧠 *Sesi belajar dimulai!*\n\n` +
      `📖 Subjek: ${subject}\n` +
      `⏱ Mulai: ${moment().tz('Asia/Jakarta').format('HH:mm [WIB]')}\n\n` +
      `Ketik /belajar lagi kalau sudah selesai ya!`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('[BELAJAR] Start error:', err.message);
    await ctx.editMessageText('Waduh, gagal mulai sesi. Coba lagi ya~');
    clearSession(chatId);
  }
}

async function endStudySession(ctx, chatId, session, isPause = false) {
  let sessionId;

  if (session) {
    sessionId = session.data.sessionId;
  } else {
    const activeSession = await db.select('study_logs', {
      columns: 'id',
      where: { chat_id: chatId, is_active: true },
      orderBy: 'start_time',
      orderDir: 'DESC',
      single: true,
    });
    if (!activeSession) {
      clearSession(chatId);
      await ctx.editMessageText('Sesi udah ga aktif. Ketik /belajar lagi ya~');
      return;
    }
    sessionId = activeSession.id;
  }

  if (!sessionId) {
    clearSession(chatId);
    await ctx.editMessageText('Sesi udah ga aktif. Ketik /belajar lagi ya~');
    return;
  }

  try {
    const nowWIB = moment().tz('Asia/Jakarta');
    const nowISO = nowWIB.toISOString();

    const sesi = await db.select('study_logs', {
      columns: 'start_time, subject',
      where: { id: sessionId },
      single: true,
    });

    const startMoment = moment(sesi.start_time).tz('Asia/Jakarta');
    const durationMinutes = Math.round(nowWIB.diff(startMoment, 'minutes'));

    await db.update('study_logs', {
      end_time: nowISO,
      duration_minutes: durationMinutes,
      is_active: false,
    }, { id: sessionId });

    const weekStart = moment().tz('Asia/Jakarta').startOf('isoWeek').toISOString();
    const weekLogs = await db.find('study_logs', {
      columns: 'duration_minutes',
      filters: [
        { key: 'chat_id', op: '=', val: chatId },
        { key: 'is_active', op: '=', val: false },
        { key: 'end_time', op: '>=', val: weekStart },
        { key: 'duration_minutes', op: 'is', val: 'not null' },
      ],
    });

    const totalMinutes = (weekLogs || []).reduce((sum, l) => sum + (l.duration_minutes || 0), 0);

    clearSession(chatId);

    if (isPause) {
      await ctx.editMessageText(
        `⏸ Sesi di-pause dulu.\n\n` +
        `📖 ${sesi.subject}\n⏱ ${formatDuration(durationMinutes)}\n\n` +
        `Ketik /belajar kalau mau lanjut lagi ya~`
      );
    } else {
      await ctx.editMessageText(
        `🎉 *Sesi selesai!*\n\n` +
        `📖 Subjek: ${sesi.subject}\n` +
        `⏱ Durasi: *${formatDuration(durationMinutes)}*\n\n` +
        `📊 Total belajar minggu ini: *${formatDuration(totalMinutes)}*\n` +
        `Keren, pertahankan! 💪`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (err) {
    console.error('[BELAJAR] End error:', err.message);
    await ctx.editMessageText('Waduh, gagal nutup sesi. Coba lagi ya~');
    clearSession(chatId);
  }
}

async function cancelStudySession(ctx, chatId, session) {
  let sessionId;

  if (session) {
    sessionId = session.data.sessionId;
  } else {
    const activeSession = await db.select('study_logs', {
      columns: 'id',
      where: { chat_id: chatId, is_active: true },
      orderBy: 'start_time',
      orderDir: 'DESC',
      single: true,
    });
    if (!activeSession) {
      clearSession(chatId);
      await ctx.editMessageText('Oke, lanjut~');
      return;
    }
    sessionId = activeSession.id;
  }

  if (!sessionId) {
    clearSession(chatId);
    await ctx.editMessageText('Oke, lanjut~');
    return;
  }

  try {
    await db.delete('study_logs', { id: sessionId });

    clearSession(chatId);
    await ctx.editMessageText('🗑 Oke, sesi dibatalkan dan tidak dihitung.');
  } catch (err) {
    console.error('[BELAJAR] Cancel error:', err.message);
    await ctx.editMessageText('Waduh, gagal batalin sesi. Coba lagi ya~');
    clearSession(chatId);
  }
}

module.exports = { belajarHandler, belajarCallbackHandler, belajarTextHandler };

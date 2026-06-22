const db = require('../config/database');
const { formatRupiah, formatDate, formatDaysRemaining, priorityEmoji } = require('../utils/formatters');
const { mainKeyboard, rekapKeyboard } = require('../utils/keyboard');
const moment = require('moment-timezone');

async function rekapHandler(ctx) {
  await ctx.reply('📊 Mau rekap periode apa?', rekapKeyboard());
}

async function rekapCallbackHandler(ctx) {
  const chatId = ctx.chat.id;
  const data = ctx.callbackQuery.data;

  if (data === 'rekap_tutup') {
    await ctx.deleteMessage();
    await ctx.answerCbQuery();
    return;
  }

  let startDate, endDate, label;

  const nowWIB = moment().tz('Asia/Jakarta');

  switch (data) {
    case 'rekap_hari':
      startDate = nowWIB.clone().startOf('day');
      endDate = nowWIB.clone().endOf('day');
      label = 'Hari Ini';
      break;
    case 'rekap_minggu':
      startDate = nowWIB.clone().startOf('isoWeek');
      endDate = nowWIB.clone().endOf('isoWeek');
      label = 'Minggu Ini';
      break;
    case 'rekap_bulan':
      startDate = nowWIB.clone().startOf('month');
      endDate = nowWIB.clone().endOf('month');
      label = 'Bulan Ini';
      break;
    default:
      await ctx.answerCbQuery();
      return;
  }

  await ctx.answerCbQuery(`Memuat rekap ${label.toLowerCase()}...`);

  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

  try {
    let message = `📊 *REKAP KEUANGAN — ${label}*\n\n`;

    const finances = await db.find('finances', {
      columns: 'type, amount, note',
      filters: [
        { key: 'chat_id', op: '=', val: chatId },
        { key: 'created_at', op: '>=', val: startISO },
        { key: 'created_at', op: '<=', val: endISO },
      ],
      orderBy: 'created_at',
      orderDir: 'ASC',
    });

    const masuk = (finances || []).filter(f => f.type === 'masuk');
    const keluar = (finances || []).filter(f => f.type === 'keluar');

    const totalMasuk = masuk.reduce((sum, f) => sum + parseFloat(f.amount), 0);
    const totalKeluar = keluar.reduce((sum, f) => sum + parseFloat(f.amount), 0);
    const net = totalMasuk - totalKeluar;

    message += '💰 *Pemasukan:*\n';
    if (masuk.length === 0) {
      message += '  _(belum ada)_\n';
    } else {
      masuk.forEach(f => {
        message += `  ${f.note.padEnd(20)} ${formatRupiah(f.amount)}\n`;
      });
    }
    message += `  \`──────────────────────────\`\n`;
    message += `  Total${' '.repeat(16)} ${formatRupiah(totalMasuk)}\n\n`;

    message += '💸 *Pengeluaran:*\n';
    if (keluar.length === 0) {
      message += '  _(belum ada)_\n';
    } else {
      keluar.forEach(f => {
        message += `  ${f.note.padEnd(20)} ${formatRupiah(f.amount)}\n`;
      });
    }
    message += `  \`──────────────────────────\`\n`;
    message += `  Total${' '.repeat(16)} ${formatRupiah(totalKeluar)}\n\n`;

    const netSign = net >= 0 ? '+' : '';
    message += `📈 *Net: ${netSign}${formatRupiah(net)}*\n\n`;

    // === REKAP TUGAS ===
    message += `📚 *TUGAS AKTIF*\n\n`;

    const tasks = await db.select('tasks', {
      where: { chat_id: chatId, is_done: false },
      orderBy: 'deadline',
      orderDir: 'ASC',
    });

    if (!tasks || tasks.length === 0) {
      message += '✅ Tidak ada tugas aktif. Santai dulu~\n';
    } else {
      tasks.forEach(t => {
        const daysLeft = formatDaysRemaining(t.deadline);
        message += `${priorityEmoji(t.priority)} _${t.name}_ — ${daysLeft}\n`;
      });
    }

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: rekapKeyboard().reply_markup,
    });
  } catch (err) {
    console.error('[REKAP] Error:', err.message);
    await ctx.editMessageText('Waduh, gagal ambil data. Coba lagi ya~');
  }
}

module.exports = { rekapHandler, rekapCallbackHandler };

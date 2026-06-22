const db = require('../config/database');
const { setSession, getSession, clearSession } = require('../services/sessionManager');
const { validateAmount, validateNote } = require('../utils/validators');
const { formatRupiah, formatDate } = require('../utils/formatters');
const { mainKeyboard, confirmKeyboard, transactionTypeKeyboard } = require('../utils/keyboard');
const moment = require('moment-timezone');

async function keuanganHandler(ctx) {
  const chatId = ctx.chat.id;

  setSession(chatId, 'keuangan:jenis', {});
  await ctx.reply(
    'Pilih jenis transaksinya dulu~',
    transactionTypeKeyboard()
  );
}

async function keuanganCallbackHandler(ctx) {
  const chatId = ctx.chat.id;
  const data = ctx.callbackQuery.data;
  const session = getSession(chatId);

  if (!session) {
    await ctx.answerCbQuery('Sesi sudah habis. Ketik /keuangan lagi ya~');
    return;
  }

  // Handle batal dari mana saja
  if (data === 'confirm_no') {
    clearSession(chatId);
    await ctx.editMessageText('❌ Dibatalkan ya. Ada yang bisa dibantu lagi?');
    await ctx.answerCbQuery();
    return;
  }

  // Handle koreksi — balik ke step 1
  if (data === 'confirm_edit') {
    clearSession(chatId);
    await ctx.editMessageText('Oke, ulang dari awal~');
    await keuanganHandler(ctx);
    return;
  }

  if (session.state === 'keuangan:jenis') {
    if (data === 'trans_masuk' || data === 'trans_keluar') {
      const type = data.replace('trans_', '');
      setSession(chatId, 'keuangan:nominal', { type });
      await ctx.editMessageText(
        `💵 Oke, *${type === 'masuk' ? 'pemasukan' : 'pengeluaran'}*. Berapa nominalnya? (angka aja, contoh: 50000)`,
        { parse_mode: 'Markdown' }
      );
      await ctx.answerCbQuery();
    } else {
      await ctx.answerCbQuery('Pilih salah satu opsi ya~');
    }
    return;
  }

  if (session.state === 'keuangan:confirm') {
    if (data === 'confirm_yes') {
      await saveTransaksi(ctx, session);
    }
    return;
  }

  await ctx.answerCbQuery();
}

async function keuanganTextHandler(ctx, text) {
  const chatId = ctx.chat.id;
  const session = getSession(chatId);

  if (!session) return false;

  if (session.state === 'keuangan:nominal') {
    const validation = validateAmount(text);
    if (!validation.valid) {
      await ctx.reply('Nominalnya angka aja ya, contoh: 50000. Coba lagi~');
      return true;
    }

    setSession(chatId, 'keuangan:catatan', {
      ...session.data,
      amount: validation.value,
    });
    await ctx.reply('Catatan: ini untuk apa? (misal: makan siang, bayar kos)');
    return true;
  }

  if (session.state === 'keuangan:catatan') {
    const validation = validateNote(text);
    if (!validation.valid) {
      await ctx.reply(validation.reason);
      return true;
    }

    // Simpan data ke session untuk konfirmasi
    setSession(chatId, 'keuangan:confirm', {
      ...session.data,
      note: validation.value,
    });

    const data = { ...session.data, note: validation.value };
    const typeLabel = data.type === 'masuk' ? '💰 Pemasukan' : '💸 Pengeluaran';

    await ctx.reply(
      '```\n' +
      '┌─────────────────────────┐\n' +
      `│ 📋 RINGKASAN TRANSAKSI  │\n` +
      `│ Jenis  : ${typeLabel.padEnd(21)}│\n` +
      `│ Nominal: ${formatRupiah(data.amount).padEnd(21)}│\n` +
      `│ Catatan: ${data.note.padEnd(21)}│\n` +
      '└─────────────────────────┘\n' +
      '```',
      { parse_mode: 'Markdown', ...confirmKeyboard() }
    );
    return true;
  }

  return false;
}

async function saveTransaksi(ctx, session) {
  const chatId = ctx.chat.id;
  const { type, amount, note } = session.data;

  try {
    await db.insert('finances', {
      chat_id: chatId,
      type,
      amount,
      note,
      created_at: moment().tz('Asia/Jakarta').toISOString(),
    });

    const todayStart = moment().tz('Asia/Jakarta').startOf('day').toISOString();
    const todayEnd = moment().tz('Asia/Jakarta').endOf('day').toISOString();

    const totals = await db.find('finances', {
      columns: 'type, amount',
      filters: [
        { key: 'chat_id', op: '=', val: chatId },
        { key: 'created_at', op: '>=', val: todayStart },
        { key: 'created_at', op: '<=', val: todayEnd },
      ],
    });

    const masuk = (totals || [])
      .filter(t => t.type === 'masuk')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const keluar = (totals || [])
      .filter(t => t.type === 'keluar')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const net = masuk - keluar;
    const netSign = net >= 0 ? '+' : '';

    clearSession(chatId);
    await ctx.editMessageText(
      `✅ *Tercatat!*\n\n` +
      `💰 Masuk hari ini : ${formatRupiah(masuk)}\n` +
      `💸 Keluar hari ini: ${formatRupiah(keluar)}\n` +
      `📊 Net             : ${netSign}${formatRupiah(net)}`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('[KEUANGAN] Save error:', err.message);
    await ctx.editMessageText('Waduh, gagal nyimpen. Coba lagi ya~');
    clearSession(chatId);
  }
}

module.exports = { keuanganHandler, keuanganCallbackHandler, keuanganTextHandler };

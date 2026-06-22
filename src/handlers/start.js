const db = require('../config/database');
const { mainKeyboard } = require('../utils/keyboard');

async function startHandler(ctx) {
  const chatId = ctx.chat.id;
  const username = ctx.chat.username || '';
  const fullName = ctx.from.first_name || '';

  try {
    const existing = await db.select('users', {
      columns: 'chat_id',
      where: { chat_id: chatId },
      single: true,
    });

    if (!existing) {
      await db.insert('users', {
        chat_id: chatId,
        username,
        full_name: fullName,
        registered_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      });
    } else {
      await db.update('users', {
        last_seen_at: new Date().toISOString(),
        username,
        full_name: fullName,
      }, { chat_id: chatId });
    }

    const greeting = existing
      ? `Halo lagi ${fullName || 'sahabat'}! 👋 Senang lihat kamu balik~`
      : `Halo ${fullName || 'sahabat'}! 👋 Senang kenal kamu!`;

    await ctx.reply(
      `${greeting}\n\n` +
      `Aku *AsistenAI*, temen belajar kamu yang siap bantu urusan kuliah. ✨\n\n` +
      `Apa aja yang bisa aku lakuin?\n\n` +
      `📊 *Keuangan* — Catat pemasukan & pengeluaran harian\n` +
      `📚 *Tugas* — Catat deadline tugas biar ngga lupa\n` +
      `⏰ *Absen* — Pengingat absen kuliah tiap hari\n` +
      `🧠 *Belajar* — Timer sesi belajar biar produktif\n` +
      `📈 *Rekap* — Lihat ringkasan keuangan & tugas\n\n` +
      `Langsung aja pencet tombol di bawah, atau ketik perintah kaya /keuangan. 😊`,
      { parse_mode: 'Markdown', ...mainKeyboard() }
    );
  } catch (err) {
    console.error('[START] Error:', err.message);
    await ctx.reply('Waduh, ada gangguan teknis. Coba /start lagi ya~');
  }
}

async function menuHandler(ctx) {
  await startHandler(ctx);
}

async function helpHandler(ctx) {
  await ctx.reply(
    `*❓ Bantuan — AsistenAI*\n\n` +
    `Berikut perintah yang bisa kamu pakai:\n\n` +
    `/start — Mulai / reset bot\n` +
    `/menu — Tampilkan menu utama\n` +
    `/keuangan — Catat pemasukan / pengeluaran\n` +
    `/tugas — Tambah tugas baru\n` +
    `/daftartugas — Lihat semua tugas aktif\n` +
    `/selesai [id] — Tandai tugas selesai\n` +
    `/absen — Atur pengingat absen\n` +
    `/matikanabsen — Nonaktifkan pengingat absen\n` +
    `/hidupkanabsen — Aktifkan kembali pengingat absen\n` +
    `/belajar — Mulai / akhiri sesi belajar\n` +
    `/rekap — Lihat ringkasan keuangan & tugas\n` +
    `/batal — Batalkan sesi / pengisian data\n` +
    `/help — Bantuan ini\n\n` +
    `Atau kamu bisa ngobrol langsung sama aku, tanya apa aja tentang kuliah! 😊`,
    { parse_mode: 'Markdown', ...mainKeyboard() }
  );
}

module.exports = { startHandler, menuHandler, helpHandler };

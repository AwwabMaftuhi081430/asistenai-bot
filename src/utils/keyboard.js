const { Markup } = require('telegraf');

function mainKeyboard() {
  return Markup.keyboard([
    ['📊 Keuangan', '📚 Tugas'],
    ['⏰ Absen', '🧠 Belajar'],
    ['📈 Rekap', '❓ Bantuan'],
  ]).resize().persistent();
}

function confirmKeyboard() {
  return Markup.inlineKeyboard([
    Markup.button.callback('✅ Ya, Simpan', 'confirm_yes'),
    Markup.button.callback('✏️ Koreksi', 'confirm_edit'),
    Markup.button.callback('❌ Batal', 'confirm_no'),
  ]);
}

function confirmDeleteKeyboard() {
  return Markup.inlineKeyboard([
    Markup.button.callback('✅ Ya, Tetap', 'confirm_yes'),
    Markup.button.callback('✏️ Ubah Tanggal', 'confirm_edit'),
    Markup.button.callback('❌ Batal', 'confirm_no'),
  ]);
}

function transactionTypeKeyboard() {
  return Markup.inlineKeyboard([
    Markup.button.callback('💰 Pemasukan', 'trans_masuk'),
    Markup.button.callback('💸 Pengeluaran', 'trans_keluar'),
    Markup.button.callback('❌ Batal', 'confirm_no'),
  ]);
}

function priorityKeyboard() {
  return Markup.inlineKeyboard([
    Markup.button.callback('🟢 Rendah', 'prio_rendah'),
    Markup.button.callback('🟡 Normal', 'prio_normal'),
    Markup.button.callback('🔴 Tinggi', 'prio_tinggi'),
    Markup.button.callback('❌ Batal', 'confirm_no'),
  ]);
}

function studyStartKeyboard() {
  return Markup.inlineKeyboard([
    Markup.button.callback('🧠 Mulai Belajar', 'study_start'),
    Markup.button.callback('❌ Gak Jadi', 'confirm_no'),
  ]);
}

function studySubjectKeyboard() {
  return Markup.inlineKeyboard([
    Markup.button.callback('Matematika', 'subject_matematika'),
    Markup.button.callback('Fisika', 'subject_fisika'),
    Markup.button.callback('Kimia', 'subject_kimia'),
    Markup.button.callback('✏️ Lainnya', 'subject_lainnya'),
    Markup.button.callback('❌ Batal', 'confirm_no'),
  ]);
}

function studyEndKeyboard() {
  return Markup.inlineKeyboard([
    Markup.button.callback('✅ Selesai', 'study_end'),
    Markup.button.callback('⏸ Lanjutkan Nanti', 'study_pause'),
    Markup.button.callback('❌ Batalkan Sesi', 'study_cancel'),
  ]);
}

function studyCrashKeyboard() {
  return Markup.inlineKeyboard([
    Markup.button.callback('✅ Hitung Sekarang', 'study_end'),
    Markup.button.callback('🗑 Abaikan', 'study_cancel'),
  ]);
}

function rekapKeyboard() {
  return Markup.inlineKeyboard([
    Markup.button.callback('📅 Hari Ini', 'rekap_hari'),
    Markup.button.callback('📆 Minggu Ini', 'rekap_minggu'),
    Markup.button.callback('🗓 Bulan Ini', 'rekap_bulan'),
    Markup.button.callback('❌ Tutup', 'rekap_tutup'),
  ]);
}

module.exports = {
  mainKeyboard,
  confirmKeyboard,
  confirmDeleteKeyboard,
  transactionTypeKeyboard,
  priorityKeyboard,
  studyStartKeyboard,
  studySubjectKeyboard,
  studyEndKeyboard,
  studyCrashKeyboard,
  rekapKeyboard,
};

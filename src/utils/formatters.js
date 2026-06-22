const moment = require('moment-timezone');

function formatRupiah(amount) {
  const num = Number(amount);
  if (isNaN(num)) return 'Rp 0';
  return 'Rp ' + num.toLocaleString('id-ID');
}

function formatDate(dateInput) {
  const m = moment(dateInput).tz('Asia/Jakarta');
  return m.locale('id').format('D MMMM YYYY');
}

function formatDateTime(dateInput) {
  const m = moment(dateInput).tz('Asia/Jakarta');
  return m.locale('id').format('D MMMM YYYY HH:mm [WIB]');
}

function formatTime(dateInput) {
  const m = moment(dateInput).tz('Asia/Jakarta');
  return m.format('HH:mm [WIB]');
}

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0 menit';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h} jam ${m} menit`;
  if (h > 0) return `${h} jam`;
  return `${m} menit`;
}

function formatDaysRemaining(dateInput) {
  const now = moment().tz('Asia/Jakarta').startOf('day');
  const target = moment(dateInput).tz('Asia/Jakarta').startOf('day');
  const diff = target.diff(now, 'days');

  if (diff < 0) return `terlambat ${Math.abs(diff)} hari`;
  if (diff === 0) return 'hari ini';
  if (diff === 1) return 'besok';
  return `${diff} hari lagi`;
}

function formatTaskDeadline(deadline) {
  const m = moment(deadline).tz('Asia/Jakarta');
  return m.locale('id').format('D MMMM YYYY');
}

function priorityLabel(priority) {
  switch (priority) {
    case 'tinggi': return '🔴 TINGGI';
    case 'normal': return '🟡 NORMAL';
    case 'rendah': return '🟢 RENDAH';
    default: return '⚪ NORMAL';
  }
}

function priorityEmoji(priority) {
  switch (priority) {
    case 'tinggi': return '🔴';
    case 'normal': return '🟡';
    case 'rendah': return '🟢';
    default: return '⚪';
  }
}

function transactionTypeEmoji(type) {
  return type === 'masuk' ? '💰' : '💸';
}

function transactionTypeLabel(type) {
  return type === 'masuk' ? 'Pemasukan' : 'Pengeluaran';
}

module.exports = {
  formatRupiah,
  formatDate,
  formatDateTime,
  formatTime,
  formatDuration,
  formatDaysRemaining,
  formatTaskDeadline,
  priorityLabel,
  priorityEmoji,
  transactionTypeEmoji,
  transactionTypeLabel,
};

const moment = require('moment-timezone');

function validateTransactionType(type) {
  return type === 'masuk' || type === 'keluar';
}

function validateAmount(amount) {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return { valid: false, value: null };
  if (num > 999_999_999) return { valid: false, value: null };
  return { valid: true, value: Math.round(num * 100) / 100 };
}

function validateNote(note) {
  const trimmed = (note || '').trim();
  if (!trimmed) return { valid: false, reason: 'Catatannya jangan kosong dong. Isi dulu ya~' };
  if (trimmed.length > 200) return { valid: false, reason: 'Catatan kepanjangan, maksimal 200 karakter ya.' };
  return { valid: true, value: trimmed };
}

function validateTaskName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { valid: false, reason: 'Nama tugasnya jangan kosong. Mau dicatat apa?' };
  if (trimmed.length > 100) return { valid: false, reason: 'Nama tugas kepanjangan, maksimal 100 karakter ya.' };
  return { valid: true, value: trimmed };
}

function validateDeadline(dateStr) {
  const regex = /^\d{2}-\d{2}-\d{4}$/;
  if (!regex.test(dateStr)) {
    return { valid: false, reason: 'Format tanggal harus DD-MM-YYYY. Contoh: 25-06-2026' };
  }

  const m = moment(dateStr, 'DD-MM-YYYY', true);
  if (!m.isValid()) {
    return { valid: false, reason: 'Tanggal tidak valid. Cek lagi formatnya ya, DD-MM-YYYY.' };
  }

  return { valid: true, value: m.format('YYYY-MM-DD'), moment: m, isPast: m.isBefore(moment().tz('Asia/Jakarta'), 'day') };
}

function validatePriority(priority) {
  return ['rendah', 'normal', 'tinggi'].includes(priority);
}

function validateReminderTime(timeStr) {
  const regex = /^([01]?\d|2[0-3]):[0-5]\d$/;
  if (!regex.test(timeStr)) {
    return { valid: false, reason: 'Format jam salah. Contoh yang benar: 07:15 atau 14:30 (format 24 jam)' };
  }
  return { valid: true, value: timeStr };
}

function validateSubject(subject) {
  const trimmed = (subject || '').trim();
  if (!trimmed) return { valid: false, reason: 'Subjek belajarnya apa? Isi dulu ya~' };
  if (trimmed.length > 100) return { valid: false, reason: 'Subjek kepanjangan, maksimal 100 karakter.' };
  return { valid: true, value: trimmed };
}

function escapeMarkdown(text) {
  if (!text) return '';
  return String(text)
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

module.exports = {
  validateTransactionType,
  validateAmount,
  validateNote,
  validateTaskName,
  validateDeadline,
  validatePriority,
  validateReminderTime,
  validateSubject,
  escapeMarkdown,
};

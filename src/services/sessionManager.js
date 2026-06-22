const sessions = {};
const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 menit

let timeoutNotifier = null;

function setNotifyTimeout(fn) {
  timeoutNotifier = fn;
}

async function notifyTimeout(chatId) {
  if (timeoutNotifier) {
    try {
      await timeoutNotifier(chatId);
    } catch (_) {
      // notifier gagal, skip
    }
  }
}

function setSession(chatId, state, data = {}) {
  const existing = sessions[chatId];
  if (existing && existing.timer) {
    clearTimeout(existing.timer);
  }

  sessions[chatId] = {
    state,
    data,
    startedAt: Date.now(),
    timer: setTimeout(() => {
      if (sessions[chatId]) {
        const cid = chatId;
        delete sessions[chatId];
        notifyTimeout(cid);
      }
    }, SESSION_TIMEOUT_MS),
  };
}

function getSession(chatId) {
  return sessions[chatId] || null;
}

function clearSession(chatId) {
  const existing = sessions[chatId];
  if (existing && existing.timer) {
    clearTimeout(existing.timer);
  }
  delete sessions[chatId];
}

function getActiveSessionsCount() {
  return Object.keys(sessions).length;
}

module.exports = {
  setSession,
  getSession,
  clearSession,
  getActiveSessionsCount,
  setNotifyTimeout,
};

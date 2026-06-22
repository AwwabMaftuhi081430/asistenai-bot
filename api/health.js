const moment = require('moment-timezone');
const { getActiveSessionsCount } = require('../src/services/sessionManager');

module.exports = function handler(req, res) {
  res.json({
    status: 'OK',
    uptime_seconds: Math.round(process.uptime()),
    timestamp: moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss [WIB]'),
    sessions_active: getActiveSessionsCount(),
    memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  });
};

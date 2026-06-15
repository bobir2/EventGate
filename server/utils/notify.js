const { run } = require('../config/db');

async function notifyAdmin(type, message) {
  try {
    await run('INSERT INTO admin_notifications (type, message) VALUES (?,?)', [type, message]);
  } catch (e) {
    console.error('notify:', e.message);
  }
}

module.exports = { notifyAdmin };

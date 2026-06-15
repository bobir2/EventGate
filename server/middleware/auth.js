const jwt = require('jsonwebtoken');
const { getOne } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'eventgate-dev-secret';

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Потрібна авторизація' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    const user = await getOne('SELECT id, email, role, is_blocked, balance, full_name, phone FROM users WHERE id = ?', [payload.id]);
    if (!user) return res.status(401).json({ error: 'Користувача не знайдено' });
    const blocked = user.is_blocked === true || user.is_blocked === 1;
    if (blocked) return res.status(403).json({ error: 'Обліковий запис заблоковано' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Недійсний токен' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ лише для адміністратора' });
  }
  next();
}

module.exports = { signToken, requireAuth, requireAdmin, JWT_SECRET };

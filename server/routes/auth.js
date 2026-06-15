const express = require('express');
const bcrypt = require('bcryptjs');
const { getOne, run } = require('../config/db');
const { signToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, phone } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email і пароль обовʼязкові' });
    }
    const exists = await getOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (exists) return res.status(409).json({ error: 'Email вже зайнятий' });

    const hash = await bcrypt.hash(password, 10);
    const result = await run(
      'INSERT INTO users (email, password_hash, full_name, phone) VALUES (?,?,?,?)',
      [email.toLowerCase(), hash, full_name || '', phone || '']
    );

    const user = await getOne('SELECT id, email, role, full_name, balance FROM users WHERE email = ?', [email.toLowerCase()]);
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await getOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user) return res.status(401).json({ error: 'Невірний email або пароль' });

    const blocked = user.is_blocked === true || user.is_blocked === 1;
    if (blocked) return res.status(403).json({ error: 'Обліковий запис заблоковано' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Невірний email або пароль' });

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name, balance: user.balance },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

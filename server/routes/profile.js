const express = require('express');
const { getAll, getOne, run } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const user = await getOne(
      'SELECT id, email, full_name, phone, role, balance, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    const orders = await getAll(
      `SELECT o.*, e.title as event_title, e.event_date, s.name as sector_name, st.row_num, st.seat_num
       FROM orders o
       JOIN seats st ON st.id = o.seat_id
       JOIN sectors s ON s.id = st.sector_id
       JOIN events e ON e.id = s.event_id
       WHERE o.user_id = ? ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    const favorites = await getAll(
      `SELECT e.* FROM favorites f JOIN events e ON e.id = f.event_id WHERE f.user_id = ?`,
      [req.user.id]
    );

    const transactions = await getAll(
      'SELECT * FROM balance_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );

    const listings = await getAll(
      `SELECT l.*, e.title as event_title FROM listings l
       JOIN orders o ON o.id = l.order_id
       JOIN seats st ON st.id = o.seat_id
       JOIN sectors s ON s.id = st.sector_id
       JOIN events e ON e.id = s.event_id
       WHERE l.seller_id = ? ORDER BY l.created_at DESC`,
      [req.user.id]
    );

    res.json({ user, orders, favorites, transactions, listings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/', async (req, res) => {
  try {
    const { full_name, phone } = req.body;
    if (full_name !== undefined) await run('UPDATE users SET full_name = ? WHERE id = ?', [full_name, req.user.id]);
    if (phone !== undefined) await run('UPDATE users SET phone = ? WHERE id = ?', [phone, req.user.id]);
    const user = await getOne(
      'SELECT id, email, full_name, phone, role, balance FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

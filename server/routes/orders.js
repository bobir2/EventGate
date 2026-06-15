const express = require('express');
const { getAll, getOne, run } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { notifyAdmin } = require('../utils/notify');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const orders = await getAll(
      `SELECT o.*, e.title as event_title, e.event_date, e.venue, e.city,
              s.name as sector_name, st.row_num, st.seat_num
       FROM orders o
       JOIN seats st ON st.id = o.seat_id
       JOIN sectors s ON s.id = st.sector_id
       JOIN events e ON e.id = s.event_id
       WHERE o.user_id = ? ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json({ orders });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/checkout', async (req, res) => {
  try {
    const { full_name, phone, email } = req.body;
    const cart = await getAll(
      `SELECT c.seat_id, st.status, s.price, e.title
       FROM cart_items c
       JOIN seats st ON st.id = c.seat_id
       JOIN sectors s ON s.id = st.sector_id
       JOIN events e ON e.id = s.event_id
       WHERE c.user_id = ?`,
      [req.user.id]
    );

    if (!cart.length) return res.status(400).json({ error: 'Кошик порожній' });

    for (const item of cart) {
      if (item.status === 'sold') {
        return res.status(400).json({ error: 'Деякі місця вже продані' });
      }
    }

    const total = cart.reduce((s, i) => s + Number(i.price), 0);
    const user = await getOne('SELECT balance, full_name, email FROM users WHERE id = ?', [req.user.id]);
    if (Number(user.balance) < total) {
      return res.status(400).json({ error: `Недостатньо коштів. Потрібно ${total} ₴, на балансі ${user.balance} ₴` });
    }

    if (full_name) await run('UPDATE users SET full_name = ? WHERE id = ?', [full_name, req.user.id]);
    if (phone) await run('UPDATE users SET phone = ? WHERE id = ?', [phone, req.user.id]);

    for (const item of cart) {
      await run("UPDATE seats SET status = 'sold' WHERE id = ?", [item.seat_id]);
      await run(
        'INSERT INTO orders (user_id, seat_id, total_price, status) VALUES (?,?,?,?)',
        [req.user.id, item.seat_id, item.price, 'active']
      );
    }

    await run('UPDATE users SET balance = balance - ? WHERE id = ?', [total, req.user.id]);
    await run(
      'INSERT INTO balance_transactions (user_id, amount, type, description) VALUES (?,?,?,?)',
      [req.user.id, -total, 'purchase', `Покупка ${cart.length} квитк(ів)`]
    );
    await run('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);

    await notifyAdmin('order', `Нове замовлення від ${full_name || user.full_name || user.email}: ${cart.length} квитк(ів) на ${total} ₴`);

    res.json({ ok: true, total, tickets: cart.length, contact: { full_name, phone, email } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

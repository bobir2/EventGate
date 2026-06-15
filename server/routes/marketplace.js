const express = require('express');
const { getAll, getOne, run } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { notifyAdmin } = require('../utils/notify');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const listings = await getAll(
      `SELECT l.*, e.title as event_title, e.event_date, e.venue, e.city, e.event_type, e.image_url,
              u.full_name as seller_name, s.name as sector_name, st.row_num, st.seat_num
       FROM listings l
       JOIN orders o ON o.id = l.order_id
       JOIN users u ON u.id = l.seller_id
       JOIN seats st ON st.id = o.seat_id
       JOIN sectors s ON s.id = st.sector_id
       JOIN events e ON e.id = s.event_id
       WHERE l.status = 'approved'
       ORDER BY l.created_at DESC`
    );
    res.json({ listings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/my', requireAuth, async (req, res) => {
  try {
    const listings = await getAll(
      `SELECT l.*, e.title as event_title FROM listings l
       JOIN orders o ON o.id = l.order_id
       JOIN seats st ON st.id = o.seat_id
       JOIN sectors s ON s.id = st.sector_id
       JOIN events e ON e.id = s.event_id
       WHERE l.seller_id = ? ORDER BY l.created_at DESC`,
      [req.user.id]
    );
    res.json({ listings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { order_id, price, transfer_method } = req.body;
    if (!price || price <= 0) return res.status(400).json({ error: 'Вкажіть коректну ціну' });

    const order = await getOne('SELECT * FROM orders WHERE id = ? AND user_id = ?', [order_id, req.user.id]);
    if (!order) return res.status(404).json({ error: 'Замовлення не знайдено' });
    if (order.status !== 'active') return res.status(400).json({ error: 'Квиток недоступний для продажу' });

    const existing = await getOne(
      `SELECT id FROM listings WHERE order_id = ? AND status IN ('pending','approved')`,
      [order_id]
    );
    if (existing) return res.status(400).json({ error: 'Оголошення вже існує' });

    await run(
      'INSERT INTO listings (seller_id, order_id, price, transfer_method, status) VALUES (?,?,?,?,?)',
      [req.user.id, order_id, price, transfer_method || 'електронно', 'pending']
    );
    await notifyAdmin('listing', `Нове оголошення на вторинному ринку від ${req.user.full_name || req.user.email}: ${price} ₴`);
    res.status(201).json({ ok: true, message: 'Оголошення надіслано на модерацію' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/buy', requireAuth, async (req, res) => {
  try {
    const listing = await getOne(`SELECT * FROM listings WHERE id = ? AND status = 'approved'`, [req.params.id]);
    if (!listing) return res.status(404).json({ error: 'Оголошення не знайдено' });
    if (listing.seller_id === req.user.id) return res.status(400).json({ error: 'Не можна купити власний квиток' });

    const buyer = await getOne('SELECT balance FROM users WHERE id = ?', [req.user.id]);
    if (Number(buyer.balance) < Number(listing.price)) {
      return res.status(400).json({ error: 'Недостатньо коштів на балансі' });
    }

    const order = await getOne('SELECT * FROM orders WHERE id = ?', [listing.order_id]);

    await run('UPDATE users SET balance = balance - ? WHERE id = ?', [listing.price, req.user.id]);
    await run('UPDATE users SET balance = balance + ? WHERE id = ?', [listing.price, listing.seller_id]);
    await run('UPDATE orders SET user_id = ?, status = ? WHERE id = ?', [req.user.id, 'active', order.id]);
    await run('UPDATE listings SET status = ? WHERE id = ?', ['sold', listing.id]);

    await run('INSERT INTO balance_transactions (user_id, amount, type, description) VALUES (?,?,?,?)',
      [req.user.id, -listing.price, 'purchase', 'Покупка на вторинному ринку']);
    await run('INSERT INTO balance_transactions (user_id, amount, type, description) VALUES (?,?,?,?)',
      [listing.seller_id, listing.price, 'sale', 'Продаж на вторинному ринку']);

    res.json({ ok: true, message: 'Квиток успішно придбано' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

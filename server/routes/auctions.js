const express = require('express');
const { getAll, getOne, run } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { notifyAdmin } = require('../utils/notify');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const dateFilter = "a.ends_at > NOW()";
    const auctions = await getAll(
      `SELECT a.*, e.title as event_title, e.venue, st.row_num, st.seat_num, s.name as sector_name
       FROM auctions a
       JOIN events e ON e.id = a.event_id
       JOIN seats st ON st.id = a.seat_id
       JOIN sectors s ON s.id = st.sector_id
       WHERE a.status = 'active' AND ${dateFilter}
       ORDER BY a.ends_at ASC`
    );
    res.json({ auctions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const auction = await getOne(
      `SELECT a.*, e.title as event_title, st.row_num, st.seat_num, s.name as sector_name
       FROM auctions a
       JOIN events e ON e.id = a.event_id
       JOIN seats st ON st.id = a.seat_id
       JOIN sectors s ON s.id = st.sector_id
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!auction) return res.status(404).json({ error: 'Аукціон не знайдено' });

    const bids = await getAll(
      `SELECT b.*, u.full_name, u.email FROM auction_bids b
       JOIN users u ON u.id = b.user_id
       WHERE b.auction_id = ? ORDER BY b.amount DESC`,
      [req.params.id]
    );
    res.json({ auction, bids });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/bid', requireAuth, async (req, res) => {
  try {
    const { amount } = req.body;
    const auction = await getOne(`SELECT * FROM auctions WHERE id = ? AND status = 'active'`, [req.params.id]);
    if (!auction) return res.status(404).json({ error: 'Аукціон не знайдено' });
    if (Number(amount) <= Number(auction.current_price)) {
      return res.status(400).json({ error: 'Ставка має бути вищою за поточну' });
    }

    const user = await getOne('SELECT balance FROM users WHERE id = ?', [req.user.id]);
    if (Number(user.balance) < Number(amount)) {
      return res.status(400).json({ error: 'Недостатньо коштів для ставки' });
    }

    await run('INSERT INTO auction_bids (auction_id, user_id, amount) VALUES (?,?,?)', [
      req.params.id,
      req.user.id,
      amount,
    ]);
    await run('UPDATE auctions SET current_price = ? WHERE id = ?', [amount, req.params.id]);
    await notifyAdmin('auction', `Нова ставка ${amount} ₴ на аукціоні #${req.params.id} від ${req.user.full_name || req.user.email}`);
    res.json({ ok: true, current_price: amount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/buy-now', requireAuth, async (req, res) => {
  try {
    const auction = await getOne(`SELECT * FROM auctions WHERE id = ? AND status = 'active'`, [req.params.id]);
    if (!auction || !auction.buy_now_price) {
      return res.status(400).json({ error: 'Викуп недоступний' });
    }

    const price = Number(auction.buy_now_price);
    const user = await getOne('SELECT balance FROM users WHERE id = ?', [req.user.id]);
    if (Number(user.balance) < price) {
      return res.status(400).json({ error: 'Недостатньо коштів' });
    }

    await run('UPDATE users SET balance = balance - ? WHERE id = ?', [price, req.user.id]);
    await run('UPDATE seats SET status = ? WHERE id = ?', ['sold', auction.seat_id]);
    await run(
      'INSERT INTO orders (user_id, seat_id, total_price, status) VALUES (?,?,?,?)',
      [req.user.id, auction.seat_id, price, 'active']
    );
    await run('UPDATE auctions SET status = ?, winner_id = ?, current_price = ? WHERE id = ?', [
      'completed',
      req.user.id,
      price,
      req.params.id,
    ]);
    await run(
      'INSERT INTO balance_transactions (user_id, amount, type, description) VALUES (?,?,?,?)',
      [req.user.id, -price, 'purchase', 'Викуп квитка на аукціоні']
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

const express = require('express');
const { getAll, getOne, run } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/count', async (req, res) => {
  try {
    const row = await getOne('SELECT COUNT(*) as c FROM cart_items WHERE user_id = ?', [req.user.id]);
    res.json({ count: Number(row?.c || 0) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const items = await getAll(
      `SELECT c.id, c.seat_id, st.row_num, st.seat_num, st.status, s.name as sector_name, s.price,
              e.id as event_id, e.title as event_title, e.event_date, e.venue, e.city
       FROM cart_items c
       JOIN seats st ON st.id = c.seat_id
       JOIN sectors s ON s.id = st.sector_id
       JOIN events e ON e.id = s.event_id
       WHERE c.user_id = ?`,
      [req.user.id]
    );
    const total = items.reduce((sum, i) => sum + Number(i.price), 0);
    res.json({ items, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const ids = req.body.seat_ids || (req.body.seat_id ? [req.body.seat_id] : []);
    if (!ids.length) return res.status(400).json({ error: 'Не вказано місця' });

    const added = [];
    const skipped = [];

    for (const seat_id of ids) {
      const seat = await getOne(
        `SELECT st.*, s.price, e.title as event_title FROM seats st
         JOIN sectors s ON s.id = st.sector_id JOIN events e ON e.id = s.event_id WHERE st.id = ?`,
        [seat_id]
      );
      if (!seat) { skipped.push({ seat_id, reason: 'не знайдено' }); continue; }
      if (seat.status !== 'free') { skipped.push({ seat_id, reason: 'зайняте' }); continue; }

      const inOtherCart = await getOne(
        'SELECT user_id FROM cart_items WHERE seat_id = ? AND user_id != ?',
        [seat_id, req.user.id]
      );
      if (inOtherCart) { skipped.push({ seat_id, reason: 'в кошику іншого' }); continue; }

      const inMyCart = await getOne(
        'SELECT id FROM cart_items WHERE seat_id = ? AND user_id = ?',
        [seat_id, req.user.id]
      );
      if (inMyCart) { skipped.push({ seat_id, reason: 'вже в кошику' }); continue; }

      await run('INSERT INTO cart_items (user_id, seat_id) VALUES (?,?) ON CONFLICT DO NOTHING', [req.user.id, seat_id]);
      await run("UPDATE seats SET status = 'reserved' WHERE id = ? AND status = 'free'", [seat_id]);
      added.push(seat_id);
    }

    if (!added.length) {
      return res.status(400).json({ error: 'Жодне місце не додано', skipped });
    }

    res.status(201).json({
      ok: true,
      message: added.length === 1 ? 'Додано в кошик' : `Додано ${added.length} місць`,
      added,
      skipped,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:seatId', async (req, res) => {
  try {
    await run('DELETE FROM cart_items WHERE user_id = ? AND seat_id = ?', [req.user.id, req.params.seatId]);
    const sold = await getOne('SELECT id FROM orders WHERE seat_id = ? AND status = ?', [req.params.seatId, 'active']);
    if (!sold) {
      await run("UPDATE seats SET status = 'free' WHERE id = ? AND status = 'reserved'", [req.params.seatId]);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

const express = require('express');
const { getAll, getOne, run } = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/stats', async (req, res) => {
  try {
    const users = await getOne('SELECT COUNT(*) as count FROM users');
    const events = await getOne('SELECT COUNT(*) as count FROM events WHERE is_archived = 0 OR is_archived IS NULL');
    const orders = await getOne('SELECT COUNT(*) as count FROM orders');
    const revenue = await getOne('SELECT COALESCE(SUM(total_price),0) as total FROM orders');
    const pending = await getOne(`SELECT COUNT(*) as count FROM listings WHERE status = 'pending'`);
    const unread = await getOne('SELECT COUNT(*) as count FROM admin_notifications WHERE is_read = 0');
    res.json({
      users: Number(users.count),
      events: Number(events.count),
      orders: Number(orders.count),
      revenue: Number(revenue.total),
      pending_listings: Number(pending.count),
      unread_notifications: Number(unread?.count || 0),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/notifications', async (req, res) => {
  try {
    const notifications = await getAll(
      'SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 50'
    );
    res.json({ notifications });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/notifications/read-all', async (req, res) => {
  try {
    await run('UPDATE admin_notifications SET is_read = 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await getAll(
      'SELECT id, email, full_name, phone, role, balance, is_blocked, created_at FROM users ORDER BY id'
    );
    res.json({ users });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/users/:id/topup', async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Сума має бути більше 0' });
    await run('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, req.params.id]);
    await run(
      'INSERT INTO balance_transactions (user_id, amount, type, description) VALUES (?,?,?,?)',
      [req.params.id, amount, 'topup', 'Нарахування адміністратором']
    );
    const user = await getOne('SELECT id, email, balance FROM users WHERE id = ?', [req.params.id]);
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/users/:id/block', async (req, res) => {
  try {
    const { blocked } = req.body;
    const val = blocked ? 1 : 0;
    await run('UPDATE users SET is_blocked = ? WHERE id = ?', [val, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const orders = await getAll(
      `SELECT o.*, u.email, u.full_name, e.title as event_title, s.name as sector_name, st.row_num, st.seat_num
       FROM orders o
       JOIN users u ON u.id = o.user_id
       JOIN seats st ON st.id = o.seat_id
       JOIN sectors s ON s.id = st.sector_id
       JOIN events e ON e.id = s.event_id
       ORDER BY o.created_at DESC`
    );
    res.json({ orders });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/orders/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/events', async (req, res) => {
  try {
    const events = await getAll('SELECT * FROM events ORDER BY event_date DESC');
    res.json({ events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/events', async (req, res) => {
  try {
    const { title, description, event_type, venue, event_date, image_url, sectors } = req.body;
    const { getDriver } = require('../config/db');
    let eventId;

    const res2 = await run(
      `INSERT INTO events (title, description, event_type, venue, event_date, image_url) VALUES (?,?,?,?,?,?)`,
      [title, description, event_type, venue, event_date, image_url || '']
    );
    eventId = getDriver() === 'pg' ? res2.rows?.[0]?.id : res2.lastInsertRowid;

    if (getDriver() === 'pg' && !eventId) {
      const ev = await getOne('SELECT id FROM events ORDER BY id DESC LIMIT 1');
      eventId = ev?.id;
    }

    const defaultSectors = sectors || [
      { name: 'Партер', price: 500, rows_count: 4, seats_per_row: 8 },
    ];

    for (const sec of defaultSectors) {
      const r = await run(
        `INSERT INTO sectors (event_id, name, price, rows_count, seats_per_row) VALUES (?,?,?,?,?)`,
        [eventId, sec.name, sec.price, sec.rows_count, sec.seats_per_row]
      );
      let sectorId = getDriver() === 'pg' ? r.rows?.[0]?.id : r.lastInsertRowid;
      if (getDriver() === 'pg' && !sectorId) {
        const s = await getOne('SELECT id FROM sectors WHERE event_id = ? ORDER BY id DESC LIMIT 1', [eventId]);
        sectorId = s?.id;
      }
      for (let row = 1; row <= sec.rows_count; row++) {
        for (let seat = 1; seat <= sec.seats_per_row; seat++) {
          await run('INSERT INTO seats (sector_id, row_num, seat_num) VALUES (?,?,?)', [sectorId, row, seat]);
        }
      }
    }

    res.status(201).json({ id: eventId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/events/:id/archive', async (req, res) => {
  try {
    await run('UPDATE events SET is_archived = 1 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/listings', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const listings = await getAll(
      `SELECT l.*, u.email, u.full_name, e.title as event_title, s.name as sector_name, st.row_num, st.seat_num
       FROM listings l
       JOIN users u ON u.id = l.seller_id
       JOIN orders o ON o.id = l.order_id
       JOIN seats st ON st.id = o.seat_id
       JOIN sectors s ON s.id = st.sector_id
       JOIN events e ON e.id = s.event_id
       WHERE l.status = ?
       ORDER BY l.created_at DESC`,
      [status]
    );
    res.json({ listings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/listings/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Статус: approved або rejected' });
    }
    await run('UPDATE listings SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ ok: true, message: status === 'approved' ? 'Оголошення схвалено' : 'Оголошення відхилено' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

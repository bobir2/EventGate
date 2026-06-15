const express = require('express');
const { getAll, getOne, run, getDriver } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const MOODS = {
  energetic: 'Енергійний',
  romantic: 'Романтичний',
  fun: 'Веселий',
  cultural: 'Культурний',
};

router.get('/meta/filters', async (req, res) => {
  try {
    const cities = await getAll(
      `SELECT DISTINCT city FROM events WHERE city IS NOT NULL AND city != '' AND (is_archived = 0 OR is_archived IS NULL) ORDER BY city`
    );
    res.json({
      moods: Object.entries(MOODS).map(([id, label]) => ({ id, label })),
      cities: cities.map((c) => c.city),
      types: [
        { id: 'concert', label: 'Концерти' },
        { id: 'standup', label: 'Стендап' },
        { id: 'cinema', label: 'Кіно' },
      ],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/meta/mood/:mood', async (req, res) => {
  try {
    const events = await getAll(
      `SELECT e.*, MIN(s.price) as min_price,
        SUM(CASE WHEN st.status = 'free' THEN 1 ELSE 0 END) as free_seats
       FROM events e
       LEFT JOIN sectors s ON s.event_id = e.id
       LEFT JOIN seats st ON st.sector_id = s.id
       WHERE e.mood = ? AND (e.is_archived = 0 OR e.is_archived IS NULL)
       GROUP BY e.id ORDER BY e.event_date ASC LIMIT 6`,
      [req.params.mood]
    );
    res.json({ events, mood: MOODS[req.params.mood] || req.params.mood });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { type, search, sort = 'date_asc', view, city, mood, price_min, price_max, date_from, date_to } = req.query;
    let sql = `SELECT e.*, MIN(s.price) as min_price, MAX(s.price) as max_price,
               COUNT(DISTINCT st.id) as total_seats,
               SUM(CASE WHEN st.status = 'free' THEN 1 ELSE 0 END) as free_seats
               FROM events e
               LEFT JOIN sectors s ON s.event_id = e.id
               LEFT JOIN seats st ON st.sector_id = s.id
               WHERE (e.is_archived = 0 OR e.is_archived IS NULL OR e.is_archived = false)`;
    const params = [];

    if (type) { sql += ' AND e.event_type = ?'; params.push(type); }
    if (city) { sql += ' AND e.city = ?'; params.push(city); }
    if (mood) { sql += ' AND e.mood = ?'; params.push(mood); }
    if (search) {
      sql += ' AND (e.title LIKE ? OR e.venue LIKE ? OR e.city LIKE ? OR e.description LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }
    if (date_from) { sql += ' AND e.event_date >= ?'; params.push(date_from); }
    if (date_to) { sql += ' AND e.event_date <= ?'; params.push(date_to + 'T23:59:59'); }

    sql += ' GROUP BY e.id';

    if (price_min) { sql += ' HAVING min_price >= ?'; params.push(Number(price_min)); }
    if (price_max) { sql += price_min ? ' AND max_price <= ?' : ' HAVING max_price <= ?'; params.push(Number(price_max)); }

    if (sort === 'price_asc') sql += ' ORDER BY min_price ASC';
    else if (sort === 'price_desc') sql += ' ORDER BY min_price DESC';
    else if (sort === 'date_desc') sql += ' ORDER BY e.event_date DESC';
    else if (sort === 'title') sql += ' ORDER BY e.title ASC';
    else sql += ' ORDER BY e.event_date ASC';

    const events = await getAll(sql, params);
    res.json({ events, view: view || 'grid' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (req.params.id === 'meta') return res.status(404).json({ error: 'Not found' });
    const event = await getOne('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (!event) return res.status(404).json({ error: 'Подію не знайдено' });

    const sectors = await getAll(
      `SELECT s.*, (SELECT COUNT(*) FROM seats WHERE sector_id = s.id AND status = 'free') as free_count
       FROM sectors s WHERE s.event_id = ?`,
      [req.params.id]
    );

    let isFavorite = false;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      try {
        const { requireAuth } = require('../middleware/auth');
        const jwt = require('jsonwebtoken');
        const payload = jwt.verify(req.headers.authorization.slice(7), process.env.JWT_SECRET || 'eventgate-dev-secret');
        const fav = await getOne('SELECT 1 FROM favorites WHERE user_id = ? AND event_id = ?', [payload.id, req.params.id]);
        isFavorite = !!fav;
      } catch {}
    }

    res.json({ ...event, sectors, isFavorite, moodLabel: MOODS[event.mood] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/seats', async (req, res) => {
  try {
    const seats = await getAll(
      `SELECT st.id, st.row_num, st.seat_num, st.status, s.name as sector_name, s.price, s.id as sector_id
       FROM seats st JOIN sectors s ON s.id = st.sector_id
       WHERE s.event_id = ? ORDER BY s.id, st.row_num, st.seat_num`,
      [req.params.id]
    );
    res.json({ seats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/favorite', requireAuth, async (req, res) => {
  try {
    if (getDriver() === 'pg') {
      await run('INSERT INTO favorites (user_id, event_id) VALUES (?,?) ON CONFLICT DO NOTHING', [req.user.id, req.params.id]);
    } else {
      await run('INSERT OR IGNORE INTO favorites (user_id, event_id) VALUES (?,?)', [req.user.id, req.params.id]);
    }
    res.json({ ok: true, message: 'Додано в обране' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id/favorite', requireAuth, async (req, res) => {
  try {
    await run('DELETE FROM favorites WHERE user_id = ? AND event_id = ?', [req.user.id, req.params.id]);
    res.json({ ok: true, message: 'Видалено з обраного' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

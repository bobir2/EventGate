const express = require('express');
const { getAll, getOne, run } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/suggest', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const events = await getAll(
      `SELECT e.*, MIN(s.price) as min_price FROM events e
       LEFT JOIN sectors s ON s.event_id = e.id
       WHERE e.event_date LIKE ? AND (e.is_archived = 0 OR e.is_archived IS NULL)
       GROUP BY e.id ORDER BY e.event_date ASC`,
      [`${targetDate}%`]
    );

    const byType = { concert: [], standup: [], cinema: [] };
    events.forEach((e) => { if (byType[e.event_type]) byType[e.event_type].push(e); });

    const route = [];
    if (byType.cinema[0]) route.push(byType.cinema[0]);
    if (byType.standup[0]) route.push(byType.standup[0]);
    if (byType.concert[0]) route.push(byType.concert[0]);
    events.forEach((e) => { if (!route.find((r) => r.id === e.id) && route.length < 4) route.push(e); });

    res.json({ date: targetDate, suggested: route.slice(0, 4), all: events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const routes = await getAll(
      'SELECT * FROM evening_routes WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    const enriched = await Promise.all(
      routes.map(async (r) => {
        const ids = JSON.parse(r.event_ids || '[]');
        const events = ids.length
          ? await getAll(`SELECT id, title, event_date, venue, city, event_type FROM events WHERE id IN (${ids.map(() => '?').join(',')})`, ids)
          : [];
        return { ...r, events };
      })
    );
    res.json({ routes: enriched });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, event_ids } = req.body;
    if (!title || !event_ids?.length) {
      return res.status(400).json({ error: 'Назва і хоча б одна подія обовʼязкові' });
    }
    await run(
      'INSERT INTO evening_routes (user_id, title, event_ids) VALUES (?,?,?)',
      [req.user.id, title, JSON.stringify(event_ids)]
    );
    res.status(201).json({ ok: true, message: 'Маршрут вечора збережено' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await run('DELETE FROM evening_routes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

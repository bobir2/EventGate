const express = require('express');
const { getAll, run } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const events = await getAll(
      'SELECT * FROM calendar_events WHERE user_id = ? ORDER BY event_date ASC',
      [req.user.id]
    );
    res.json({ events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, event_date } = req.body;
    if (!title || !event_date) {
      return res.status(400).json({ error: 'Назва і дата обовʼязкові' });
    }
    await run(
      'INSERT INTO calendar_events (user_id, title, event_date) VALUES (?,?,?)',
      [req.user.id, title, event_date]
    );
    res.status(201).json({ ok: true, message: 'Подію додано в календар' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await run('DELETE FROM calendar_events WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

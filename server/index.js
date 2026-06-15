require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./config/db');
const { main: initDatabase } = require('./db/init');

const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');
const cartRoutes = require('./routes/cart');
const ordersRoutes = require('./routes/orders');
const profileRoutes = require('./routes/profile');
const marketplaceRoutes = require('./routes/marketplace');
const calendarRoutes = require('./routes/calendar');
const adminRoutes = require('./routes/admin');
const auctionsRoutes = require('./routes/auctions');
const eveningRoutes = require('./routes/evening');

const app = express();
const PORT = process.env.PORT || 3000;

initDb();

(async () => {
  try {
    await initDatabase();
  } catch (e) {
    console.error('DB init warning:', e.message);
  }
})();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auctions', auctionsRoutes);
app.use('/api/evening', eveningRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'EventGate' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
});

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});

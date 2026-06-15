const { getDriver, run, getOne, getAll } = require('../config/db');

async function tryRun(sql) {
  try {
    await run(sql);
  } catch (e) {
    if (!/duplicate column|already exists/i.test(e.message)) {}
  }
}

async function migrate() {
  await tryRun('ALTER TABLE events ADD COLUMN city TEXT');
  await tryRun('ALTER TABLE events ADD COLUMN mood TEXT');

  const tables = [
    `CREATE TABLE IF NOT EXISTS evening_routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      event_ids TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS admin_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  ];

  for (const sql of tables) {
    await run(sql);
  }
}

const TYPE_IMAGES = {
  concert: '/images/events/01.jpg',
  standup: '/images/events/02.jpg',
  cinema: '/images/events/03.jpg',
  default: '/images/events/01.jpg',
};

const EVENT_CATALOG = [
  { title: 'Океан Ельзи — великий концерт', description: 'Концерт гурту в Палаці спорту. Програма з хітів і нових пісень.', event_type: 'concert', venue: 'Палац спорту', city: 'Київ', mood: 'energetic', event_date: '2026-08-15T19:00:00', image_url: '/images/events/01.jpg', sectors: [{ name: 'Партер', price: 1200, rows: 6, seats: 10 }, { name: 'Балкон', price: 700, rows: 4, seats: 12 }, { name: 'VIP', price: 2500, rows: 2, seats: 6 }] },
  { title: 'Стендап: Відкритий мікрофон', description: 'Вечір стендапу в Comedy Club.', event_type: 'standup', venue: 'Comedy Club', city: 'Львів', mood: 'fun', event_date: '2026-07-20T20:00:00', image_url: '/images/events/02.jpg', sectors: [{ name: 'Столик біля сцени', price: 600, rows: 3, seats: 6 }, { name: 'Зал', price: 400, rows: 5, seats: 8 }] },
  { title: 'Премʼєра: «Довга дорога додому»', description: 'Новий український фільм у форматі IMAX. Драма про подорож і надію.', event_type: 'cinema', venue: 'Кінотеатр «Україна»', city: 'Одеса', mood: 'cultural', event_date: '2026-06-25T18:30:00', image_url: '/images/events/03.jpg', sectors: [{ name: 'IMAX', price: 350, rows: 8, seats: 14 }, { name: 'Стандарт', price: 200, rows: 6, seats: 12 }] },
  { title: 'Kalush Orchestra — Live', description: 'Живий виступ гурту.', event_type: 'concert', venue: 'МЦКМ «Жовтневий палац»', city: 'Київ', mood: 'energetic', event_date: '2026-09-05T20:00:00', image_url: '/images/events/04.jpg', sectors: [{ name: 'Партер', price: 1500, rows: 5, seats: 10 }, { name: 'Балкон', price: 900, rows: 4, seats: 10 }] },
  { title: 'Теща з дороги — стендап шоу', description: 'Сольний стендап-виступ.', event_type: 'standup', venue: 'Torba Hall', city: 'Київ', mood: 'fun', event_date: '2026-07-10T19:30:00', image_url: '/images/events/05.jpg', sectors: [{ name: 'Партер', price: 800, rows: 4, seats: 8 }, { name: 'Балкон', price: 500, rows: 3, seats: 10 }] },
  { title: 'Дюна: Частина друга — IMAX', description: 'Епічне продовження культової саги на великому екрані.', event_type: 'cinema', venue: 'Multiplex Dream Town', city: 'Київ', mood: 'cultural', event_date: '2026-08-01T21:00:00', image_url: '/images/events/06.jpg', sectors: [{ name: 'IMAX', price: 400, rows: 7, seats: 14 }] },
  { title: 'Jazz Evening з Pianoбой', description: 'Романтичний вечір живої музики та імпровізації.', event_type: 'concert', venue: 'Львівська Опера', city: 'Львів', mood: 'romantic', event_date: '2026-07-28T19:00:00', image_url: '/images/events/07.jpg', sectors: [{ name: 'Партер', price: 900, rows: 5, seats: 8 }, { name: 'Ложа', price: 1400, rows: 2, seats: 4 }] },
  { title: 'Казанова — імпровізаційний стендап', description: 'Гострі жарти та імпровізація без сценарію.', event_type: 'standup', venue: 'Морський вокзал', city: 'Одеса', mood: 'fun', event_date: '2026-08-08T20:30:00', image_url: '/images/events/08.jpg', sectors: [{ name: 'Зал', price: 450, rows: 5, seats: 10 }] },
  { title: 'Фестиваль короткометражок', description: 'Кращі короткі фільми молодих українських режисерів.', event_type: 'cinema', venue: 'Будинок кіно', city: 'Харків', mood: 'cultural', event_date: '2026-07-15T17:00:00', image_url: '/images/events/09.jpg', sectors: [{ name: 'Зал 1', price: 180, rows: 6, seats: 12 }] },
  { title: 'Антитіла — Симфонічний вечір', description: 'Поп-рок у супроводі симфонічного оркестру.', event_type: 'concert', venue: 'Локомотив Арена', city: 'Харків', mood: 'energetic', event_date: '2026-09-20T19:00:00', image_url: '/images/events/10.jpg', sectors: [{ name: 'Партер', price: 1100, rows: 6, seats: 10 }, { name: 'Трибуна', price: 650, rows: 5, seats: 12 }] },
  { title: 'Вечір українського кіно', description: 'Показ класики та сучасних стрічок українського кінематографа.', event_type: 'cinema', venue: 'Кінотеатр «Родина»', city: 'Одеса', mood: 'cultural', event_date: '2026-06-30T19:00:00', image_url: '/images/events/11.jpg', sectors: [{ name: 'Зал', price: 220, rows: 5, seats: 14 }] },
  { title: 'С.K.A.Y. — Акустичний концерт', description: 'Знамениті пісні у камерному форматі.', event_type: 'concert', venue: 'Caribbean Club', city: 'Київ', mood: 'romantic', event_date: '2026-08-22T20:00:00', image_url: '/images/events/12.jpg', sectors: [{ name: 'Партер', price: 950, rows: 4, seats: 8 }] },
  { title: 'Open Mic Comedy Night', description: 'Нові імена стендапу та непередбачуваний гумор.', event_type: 'standup', venue: 'Urban Space 500', city: 'Львів', mood: 'fun', event_date: '2026-07-05T21:00:00', image_url: '/images/events/13.jpg', sectors: [{ name: 'Зал', price: 350, rows: 4, seats: 8 }] },
  { title: 'Музичний фестиваль «Країна мрій»', description: 'Дводенний фестиваль етнічної та сучасної музики.', event_type: 'concert', venue: 'Парк ВДНГ', city: 'Київ', mood: 'energetic', event_date: '2026-08-30T16:00:00', image_url: '/images/events/14.jpg', sectors: [{ name: 'Фан-зона', price: 500, rows: 8, seats: 15 }, { name: 'VIP-тераса', price: 1800, rows: 3, seats: 6 }] },
  { title: 'Романтичне кіно під зірками', description: 'Open-air показ фільму для двох на даху.', event_type: 'cinema', venue: 'Rooftop Cinema', city: 'Львів', mood: 'romantic', event_date: '2026-08-14T21:30:00', image_url: '/images/events/15.jpg', sectors: [{ name: 'Деки', price: 300, rows: 5, seats: 8 }] },
];

async function createEventWithSeats(ev) {
  const res = await run(
    `INSERT INTO events (title, description, event_type, venue, city, mood, event_date, image_url) VALUES (?,?,?,?,?,?,?,?)`,
    [ev.title, ev.description, ev.event_type, ev.venue, ev.city, ev.mood, ev.event_date, ev.image_url]
  );
  const eventId = res.lastInsertRowid || (await getOne('SELECT id FROM events ORDER BY id DESC LIMIT 1'))?.id;

  for (const sec of ev.sectors) {
    const r = await run(
      `INSERT INTO sectors (event_id, name, price, rows_count, seats_per_row) VALUES (?,?,?,?,?)`,
      [eventId, sec.name, sec.price, sec.rows, sec.seats]
    );
    const sectorId = r.lastInsertRowid || (await getOne('SELECT id FROM sectors WHERE event_id = ? ORDER BY id DESC LIMIT 1', [eventId]))?.id;
    for (let row = 1; row <= sec.rows; row++) {
      for (let seat = 1; seat <= sec.seats; seat++) {
        await run('INSERT INTO seats (sector_id, row_num, seat_num, status) VALUES (?,?,?,?)', [sectorId, row, seat, 'free']);
      }
    }
  }
  return eventId;
}

async function ensureUsers() {
  const bcrypt = require('bcryptjs');
  const admin = await getOne('SELECT id FROM users WHERE email = ?', ['admin@eventgate.local']);
  if (!admin) {
    const adminHash = await bcrypt.hash('admin123', 10);
    const userHash = await bcrypt.hash('user123', 10);
    await run(`INSERT INTO users (email, password_hash, full_name, phone, role, balance) VALUES (?,?,?,?,?,?)`,
      ['admin@eventgate.local', adminHash, 'Адміністратор', '+380501111111', 'admin', 0]);
    await run(`INSERT INTO users (email, password_hash, full_name, phone, role, balance) VALUES (?,?,?,?,?,?)`,
      ['user@eventgate.local', userHash, 'Іван Петренко', '+380502222222', 'user', 5000]);
  }
}

async function ensureEvents() {
  const count = await getOne('SELECT COUNT(*) as c FROM events');
  const existing = Number(count?.c || 0);

  if (existing >= EVENT_CATALOG.length) {
    for (const ev of EVENT_CATALOG) {
      await run('UPDATE events SET city = ?, mood = ?, image_url = ? WHERE title = ?', [ev.city, ev.mood, ev.image_url, ev.title]);
    }
    return;
  }

  if (existing > 0 && existing < EVENT_CATALOG.length) {
    const titles = (await getAll('SELECT title FROM events')).map((e) => e.title);
    for (const ev of EVENT_CATALOG) {
      if (!titles.includes(ev.title)) {
        await createEventWithSeats(ev);
      } else {
        await run('UPDATE events SET city = ?, mood = ?, description = ?, image_url = ? WHERE title = ?', [ev.city, ev.mood, ev.description, ev.image_url, ev.title]);
      }
    }
    return;
  }

  for (const ev of EVENT_CATALOG) {
    await createEventWithSeats(ev);
  }
}

async function ensureImages() {
  for (const ev of EVENT_CATALOG) {
    await run('UPDATE events SET image_url = ? WHERE title = ?', [ev.image_url, ev.title]);
  }

  const broken = await getAll(`SELECT id, event_type FROM events WHERE image_url IS NULL OR image_url = '' OR image_url LIKE 'https://%' OR image_url LIKE '/images/%.svg'`);
  for (const ev of broken) {
    const img = TYPE_IMAGES[ev.event_type] || TYPE_IMAGES.default;
    await run('UPDATE events SET image_url = ? WHERE id = ?', [img, ev.id]);
  }
}

async function ensureAuctions() {
  const count = await getOne('SELECT COUNT(*) as c FROM auctions');
  if (Number(count?.c || 0) >= 3) return;

  const events = await getAll('SELECT id, title FROM events LIMIT 5');
  for (const ev of events.slice(0, 3)) {
    const seat = await getOne(
      `SELECT st.id FROM seats st JOIN sectors s ON s.id = st.sector_id WHERE s.event_id = ? AND st.status = 'free' LIMIT 1`,
      [ev.id]
    );
    if (!seat) continue;
    const exists = await getOne('SELECT id FROM auctions WHERE seat_id = ?', [seat.id]);
    if (exists) continue;
    await run(
      `INSERT INTO auctions (event_id, seat_id, start_price, current_price, buy_now_price, ends_at, status) VALUES (?,?,?,?,?,?,?)`,
      [ev.id, seat.id, 400, 400, 900, '2026-12-31T23:59:59', 'active']
    );
  }
}

async function ensureMarketplaceListings() {
  const count = await getOne(`SELECT COUNT(*) as c FROM listings WHERE status = 'approved'`);
  if (Number(count?.c || 0) >= 6) return;

  const bcrypt = require('bcryptjs');
  let seller = await getOne('SELECT id FROM users WHERE email = ?', ['seller@eventgate.local']);
  if (!seller) {
    const hash = await bcrypt.hash('seller123', 10);
    await run(
      `INSERT INTO users (email, password_hash, full_name, phone, role, balance) VALUES (?,?,?,?,?,?)`,
      ['seller@eventgate.local', hash, 'Марія Шевченко', '+380503333333', 'user', 2000]
    );
    seller = await getOne('SELECT id FROM users WHERE email = ?', ['seller@eventgate.local']);
  }

  const events = await getAll(
    `SELECT e.id, e.title, MIN(s.price) as price FROM events e
     JOIN sectors s ON s.event_id = e.id
     WHERE e.is_archived = 0 OR e.is_archived IS NULL
     GROUP BY e.id ORDER BY e.event_date LIMIT 8`
  );

  const discounts = [0.9, 0.85, 0.75, 0.8, 0.7, 0.95, 0.88, 0.82];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const hasListing = await getOne(
      `SELECT l.id FROM listings l
       JOIN orders o ON o.id = l.order_id
       JOIN seats st ON st.id = o.seat_id
       JOIN sectors s ON s.id = st.sector_id
       WHERE s.event_id = ? AND l.status = 'approved'`,
      [ev.id]
    );
    if (hasListing) continue;

    const seat = await getOne(
      `SELECT st.id, s.price FROM seats st
       JOIN sectors s ON s.id = st.sector_id
       WHERE s.event_id = ? AND st.status = 'free' LIMIT 1 OFFSET ?`,
      [ev.id, i % 3]
    );
    if (!seat) continue;

    await run("UPDATE seats SET status = 'sold' WHERE id = ?", [seat.id]);
    const orderRes = await run(
      'INSERT INTO orders (user_id, seat_id, total_price, status) VALUES (?,?,?,?)',
      [seller.id, seat.id, seat.price, 'active']
    );
    const orderId = orderRes.lastInsertRowid || (await getOne('SELECT id FROM orders ORDER BY id DESC LIMIT 1'))?.id;
    const listPrice = Math.round(Number(seat.price) * discounts[i % discounts.length]);

    await run(
      'INSERT INTO listings (seller_id, order_id, price, transfer_method, status) VALUES (?,?,?,?,?)',
      [seller.id, orderId, listPrice, 'електронно', 'approved']
    );
  }
}

module.exports = { migrate, ensureUsers, ensureEvents, ensureImages, ensureAuctions, ensureMarketplaceListings, EVENT_CATALOG, TYPE_IMAGES };

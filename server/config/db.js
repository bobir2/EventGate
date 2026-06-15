const { Pool } = require('pg');

let pool;

function initDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL не задано. Потрібен PostgreSQL.');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

function toPgSql(sql) {
  return sql
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
    .replace(/REAL/g, 'DECIMAL(12,2)')
    .replace(/INTEGER DEFAULT 0/g, 'BOOLEAN DEFAULT FALSE')
    .replace(/is_blocked INTEGER/g, 'is_blocked BOOLEAN')
    .replace(/is_archived INTEGER/g, 'is_archived BOOLEAN')
    .replace(/is_read INTEGER/g, 'is_read BOOLEAN')
    .replace(/datetime\('now'\)/g, 'NOW()')
    .replace(/TEXT DEFAULT \(NOW\(\)\)/g, 'TIMESTAMPTZ DEFAULT NOW()');
}

async function query(sql, params = []) {
  let i = 0;
  const q = sql.replace(/\?/g, () => `$${++i}`);
  const res = await pool.query(q, params);
  return res;
}

async function getOne(sql, params = []) {
  const res = await query(sql, params);
  return res.rows[0] || null;
}

async function getAll(sql, params = []) {
  const res = await query(sql, params);
  return res.rows;
}

async function run(sql, params = []) {
  return query(sql, params);
}

async function insertId(sql, params = []) {
  let q = sql.trim().replace(/;+\s*$/, '');
  if (!/RETURNING/i.test(q)) q += ' RETURNING id';
  const res = await query(q, params);
  return res.rows[0]?.id;
}

module.exports = { initDb, toPgSql, query, getOne, getAll, run, insertId };

const path = require('path');
const fs = require('fs');

let db;
let driver = 'sqlite';

function initDb() {
  if (process.env.DATABASE_URL) {
    driver = 'pg';
    const { Pool } = require('pg');
    db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
    return db;
  }

  const Database = require('better-sqlite3');
  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'eventgate.db');
  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  return db;
}

function getDriver() {
  return driver;
}

async function query(sql, params = []) {
  let q = sql;
  if (driver === 'pg') {
    let i = 0;
    q = sql.replace(/\?/g, () => `$${++i}`);
  }
  if (driver === 'pg') {
    const res = await db.query(q, params);
    return res;
  }
  const isSelect = /^\s*(SELECT|PRAGMA|WITH)/i.test(sql);
  if (isSelect) {
    const rows = db.prepare(sql).all(...params);
    return { rows, rowCount: rows.length };
  }
  const info = db.prepare(sql).run(...params);
  return {
    rows: [],
    rowCount: info.changes,
    lastInsertRowid: info.lastInsertRowid,
  };
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

function placeholder(index) {
  return driver === 'pg' ? `$${index}` : '?';
}

module.exports = { initDb, getDriver, query, getOne, getAll, run, placeholder };

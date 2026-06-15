require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { initDb, getDriver, run } = require('../config/db');
const { migrate, ensureUsers, ensureEvents, ensureImages, ensureAuctions, ensureMarketplaceListings } = require('./migrate');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

async function execSchema() {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const driver = getDriver();

  if (driver === 'pg') {
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) =>
        s
          .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
          .replace(/REAL/g, 'DECIMAL(12,2)')
          .replace(/INTEGER DEFAULT 0/g, 'BOOLEAN DEFAULT FALSE')
          .replace(/is_blocked INTEGER/g, 'is_blocked BOOLEAN')
          .replace(/is_archived INTEGER/g, 'is_archived BOOLEAN')
          .replace(/is_read INTEGER/g, 'is_read BOOLEAN')
          .replace(/datetime\('now'\)/g, 'NOW()')
          .replace(/TEXT DEFAULT \(NOW\(\)\)/g, 'TIMESTAMPTZ DEFAULT NOW()')
      );
    for (const stmt of statements) {
      try {
        await run(stmt);
      } catch (e) {
        if (!e.message.includes('already exists')) throw e;
      }
    }
    return;
  }

  const Database = require('better-sqlite3');
  const dbPath = path.join(__dirname, '../../data/eventgate.db');
  const sqlite = new Database(dbPath);
  sqlite.exec(sql);
  sqlite.close();
}

async function main() {
  initDb();
  await execSchema();
  await migrate();
  await ensureUsers();
  await ensureEvents();
  await ensureImages();
  await ensureAuctions();
  await ensureMarketplaceListings();
  console.log('БД готова');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { execSchema, main };

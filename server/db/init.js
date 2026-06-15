require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { initDb, run, toPgSql } = require('../config/db');
const { migrate, ensureUsers, ensureEvents, ensureImages, ensureAuctions, ensureMarketplaceListings } = require('./migrate');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

async function execSchema() {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => toPgSql(s));

  for (const stmt of statements) {
    try {
      await run(stmt);
    } catch (e) {
      if (!e.message.includes('already exists')) throw e;
    }
  }
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

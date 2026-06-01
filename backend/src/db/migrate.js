const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function runMigrations() {
  console.log('Starting database migrations...');
  const migrationFile = path.join(__dirname, 'migrations', '001_init.sql');
  
  try {
    const sql = fs.readFileSync(migrationFile, 'utf8');
    await pool.query(sql);
    console.log('Migration 001_init.sql executed successfully.');
  } catch (err) {
    console.error('Error executing migration:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();

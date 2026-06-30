const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');
const bcrypt = require('bcryptjs');

async function runSeeds() {
  console.log('Starting database seeding...');
  
  try {
    // 1. Seed time slots
    const seedFile = path.join(__dirname, 'seeds', 'seed_time_slots.sql');
    const sql = fs.readFileSync(seedFile, 'utf8');
    await pool.query(sql);
    console.log('Seed seed_time_slots.sql executed successfully.');

    // 2. Seed default admin user
    const { rows } = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
    if (parseInt(rows[0].count, 10) === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await pool.query(
        "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)",
        ['admin', 'admin@lotustime.com', passwordHash, 'admin']
      );
      console.log('Default admin user created successfully (username: admin / password: admin123)');
    } else {
      console.log('Admin user already exists, skipping admin seed.');
    }
  } catch (err) {
    console.error('Error executing seed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSeeds();

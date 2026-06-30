const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function runMigrations() {
  console.log('Starting database migrations...');
  const migrationsDir = path.join(__dirname, 'migrations');
  
  try {
    // 1. Create schema_migrations table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Bootstrap existing database history if tables already exist
    const { rows: personTableCheck } = await pool.query(`
      SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'persons');
    `);
    if (personTableCheck[0].exists) {
      await pool.query(`
        INSERT INTO schema_migrations (version) VALUES ('001_init.sql') ON CONFLICT DO NOTHING;
      `);
    }

    const { rows: segmentsColumnCheck } = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name='classes' AND column_name='segments');
    `);
    if (segmentsColumnCheck[0].exists) {
      await pool.query(`
        INSERT INTO schema_migrations (version) VALUES ('003_class_segments.sql') ON CONFLICT DO NOTHING;
      `);
    }

    // 3. Fetch executed migrations
    const { rows: executedRows } = await pool.query('SELECT version FROM schema_migrations');
    const executedMigrations = new Set(executedRows.map(r => r.version));

    // 4. Scan migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    for (const file of files) {
      if (executedMigrations.has(file)) {
        console.log(`Skipping already executed migration: ${file}`);
        continue;
      }

      console.log(`Executing migration: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      // Run each migration in a transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Migration ${file} executed successfully.`);
      } catch (migrationErr) {
        await client.query('ROLLBACK');
        throw migrationErr;
      } finally {
        client.release();
      }
    }
    console.log('All migrations checked and executed successfully.');
  } catch (err) {
    console.error('Error executing migrations:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();

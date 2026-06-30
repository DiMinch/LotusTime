const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

// Prevent local .env default variables from overriding the remote connection string
const isRemote = connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');
if (isRemote) {
  delete process.env.PGHOST;
  delete process.env.PGPORT;
  delete process.env.PGUSER;
  delete process.env.PGPASSWORD;
  delete process.env.PGDATABASE;
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : false
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};

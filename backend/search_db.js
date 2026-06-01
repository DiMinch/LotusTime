const db = require('./src/db/pool');

async function find() {
  const tablesRes = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  for (let row of tablesRes.rows) {
    const tableName = row.table_name;
    try {
      const res = await db.query(`SELECT * FROM ${tableName}::text WHERE ${tableName}::text LIKE '%4de27ccc-3b09-4eaf-bb46-1ff971cd1c44%'`);
      if (res.rows.length > 0) console.log("FOUND IN TABLE:", tableName, res.rows);
    } catch (e) {}
  }
  db.end();
}
find();

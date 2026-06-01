const db = require('./src/db/pool');
async function main() {
  const { rows: mrArt } = await db.query("SELECT id FROM persons WHERE short_name = 'Mr. Art'");
  if (mrArt.length === 0) {
    console.log('Mr. Art not found');
    return;
  }
  const artId = mrArt[0].id;
  const { rows: slots } = await db.query("SELECT id FROM time_slots");
  
  // Insert availabilities for Mr. Art
  for (const s of slots) {
    await db.query(
      `INSERT INTO availabilities (week_id, person_id, time_slot_id) 
       VALUES ('d084a79d-436c-4eaa-9531-3dce9ae5b95f', $1, $2)
       ON CONFLICT DO NOTHING`,
      [artId, s.id]
    );
  }
  console.log('Added availabilities for Mr. Art');
}
main().catch(console.error).finally(() => process.exit(0));

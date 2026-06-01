const fs = require('fs');
const db = require('./src/db/pool');
const Class = require('./src/models/classes');

async function main() {
  const weekId = 'd084a79d-436c-4eaa-9531-3dce9ae5b95f';
  const classes = await Class.findAll();
  const roomsRes = await db.query(`SELECT id, name, capacity FROM rooms`);
  const timeSlotsRes = await db.query(`SELECT id, day_of_week, start_time, end_time FROM time_slots`);
  const personsRes = await db.query(`
    SELECT p.id, p.short_name, COALESCE(array_agg(pc.capability) FILTER (WHERE pc.capability IS NOT NULL), '{}') as capabilities 
    FROM persons p
    LEFT JOIN person_capabilities pc ON p.id = pc.person_id
    GROUP BY p.id
  `);
  const availRes = await db.query(`SELECT person_id, time_slot_id FROM availabilities WHERE week_id = $1`, [weekId]);
  const pinsRes = await db.query(`SELECT class_id, time_slot_id, room_id FROM sessions WHERE week_id = $1 AND is_pinned = true`, [weekId]);
  const constraintsRes = await db.query(`SELECT parsed_json FROM special_constraints WHERE week_id = $1`, [weekId]);

  const payload = {
    classes,
    rooms: roomsRes.rows,
    time_slots: timeSlotsRes.rows,
    persons: personsRes.rows,
    availabilities: availRes.rows,
    pins: pinsRes.rows,
    constraints: constraintsRes.rows.map(c => c.parsed_json)
  };

  fs.writeFileSync('../solver/payload.json', JSON.stringify(payload, null, 2));
  console.log('Payload dumped!');
}
main().catch(console.error).finally(() => process.exit(0));

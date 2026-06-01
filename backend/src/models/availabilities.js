const db = require('../db/pool');

module.exports = {
  async findByWeek(weekId) {
    const { rows } = await db.query(`
      SELECT a.*, p.short_name, ts.label AS slot_label, ts.day_of_week, ts.start_time, ts.end_time
      FROM availabilities a
      JOIN persons p ON p.id = a.person_id
      JOIN time_slots ts ON ts.id = a.time_slot_id
      WHERE a.week_id = $1
      ORDER BY p.short_name, ts.day_of_week, ts.start_time
    `, [weekId]);
    return rows;
  },

  async bulkUpsert(weekId, entries) {
    // entries = [{ person_id, time_slot_id }, ...]
    // Delete existing for this week first, then insert
    await db.query(`DELETE FROM availabilities WHERE week_id = $1`, [weekId]);
    if (entries.length === 0) return [];

    const values = entries.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(', ');
    const params = [weekId];
    entries.forEach(e => { params.push(e.person_id, e.time_slot_id); });

    const { rows } = await db.query(
      `INSERT INTO availabilities (week_id, person_id, time_slot_id) VALUES ${values} RETURNING *`,
      params
    );
    return rows;
  },

  async copyFromPreviousWeek(weekId, previousWeekId) {
    const { rows } = await db.query(`
      INSERT INTO availabilities (person_id, week_id, time_slot_id)
      SELECT person_id, $1, time_slot_id
      FROM availabilities WHERE week_id = $2
      ON CONFLICT DO NOTHING
      RETURNING *
    `, [weekId, previousWeekId]);
    return rows;
  }
};

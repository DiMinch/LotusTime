const db = require('../db/pool');

module.exports = {
  async findByWeek(weekId) {
    const { rows } = await db.query(`
      SELECT s.*, c.code as class_code, c.class_type, r.name as room_name, ts.label as slot_label,
             p.short_name as teacher_name, sa.role as assigned_role, sa.person_id,
             COALESCE((
               SELECT array_agg(pc.capability)
               FROM person_capabilities pc
               WHERE pc.person_id = p.id
             ), '{}') as teacher_capabilities
      FROM sessions s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN rooms r ON r.id = s.room_id
      LEFT JOIN time_slots ts ON ts.id = s.time_slot_id
      LEFT JOIN session_assignments sa ON sa.session_id = s.id
      LEFT JOIN persons p ON p.id = sa.person_id
      WHERE s.week_id = $1
      ORDER BY ts.day_of_week, ts.start_time
    `, [weekId]);
    return rows;
  },

  async create({ week_id, class_id, room_id, time_slot_id, is_pinned, pin_reason }) {
    const { rows } = await db.query(
      `INSERT INTO sessions (week_id, class_id, room_id, time_slot_id, is_pinned, pin_reason)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [week_id, class_id, room_id, time_slot_id, is_pinned, pin_reason]
    );
    return rows[0];
  },

  async update(id, { class_id, room_id, time_slot_id, is_pinned, pin_reason }) {
    const { rows } = await db.query(
      `UPDATE sessions 
       SET class_id=$1, room_id=$2, time_slot_id=$3, is_pinned=$4, pin_reason=$5
       WHERE id=$6 RETURNING *`,
      [class_id, room_id, time_slot_id, is_pinned, pin_reason, id]
    );
    return rows[0];
  },

  async remove(id) {
    await db.query(`DELETE FROM sessions WHERE id = $1`, [id]);
  }
};

const db = require('../db/pool');

module.exports = {
  async findAll() {
    const { rows } = await db.query(
      `SELECT * FROM time_slots WHERE is_active = true ORDER BY day_of_week, start_time`
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await db.query(`SELECT * FROM time_slots WHERE id = $1`, [id]);
    return rows[0];
  },

  async create({ label, start_time, end_time, day_of_week }) {
    const { rows } = await db.query(
      `INSERT INTO time_slots (label, start_time, end_time, day_of_week)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [label, start_time, end_time, day_of_week]
    );
    return rows[0];
  },

  async update(id, { label, start_time, end_time, day_of_week }) {
    const { rows } = await db.query(
      `UPDATE time_slots SET label=$1, start_time=$2, end_time=$3, day_of_week=$4
       WHERE id=$5 RETURNING *`,
      [label, start_time, end_time, day_of_week, id]
    );
    return rows[0];
  },

  async remove(id) {
    await db.query(`UPDATE time_slots SET is_active = false WHERE id = $1`, [id]);
  }
};

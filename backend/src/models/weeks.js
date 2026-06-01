const db = require('../db/pool');

module.exports = {
  async findAll() {
    const { rows } = await db.query(`SELECT * FROM schedule_weeks ORDER BY week_start DESC`);
    return rows;
  },

  async findById(id) {
    const { rows } = await db.query(`SELECT * FROM schedule_weeks WHERE id = $1`, [id]);
    return rows[0];
  },

  async create({ week_start }) {
    const { rows } = await db.query(
      `INSERT INTO schedule_weeks (week_start) VALUES ($1) RETURNING *`,
      [week_start]
    );
    return rows[0];
  },

  async updateStatus(id, status) {
    const extra = status === 'published' ? `, published_at = now()` : '';
    const { rows } = await db.query(
      `UPDATE schedule_weeks SET status = $1 ${extra} WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return rows[0];
  }
};

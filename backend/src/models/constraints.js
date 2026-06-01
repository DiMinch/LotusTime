const db = require('../db/pool');

module.exports = {
  async findByWeek(weekId) {
    const { rows } = await db.query(
      `SELECT * FROM special_constraints WHERE week_id = $1 ORDER BY created_at DESC`,
      [weekId]
    );
    return rows;
  },

  async create({ week_id, raw_text, parsed_json, constraint_type, priority }) {
    const { rows } = await db.query(
      `INSERT INTO special_constraints (week_id, raw_text, parsed_json, constraint_type, priority)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [week_id, raw_text, parsed_json, constraint_type, priority]
    );
    return rows[0];
  },

  async update(id, { parsed_json, constraint_type, priority, is_active, confirmed_by_user }) {
    const { rows } = await db.query(
      `UPDATE special_constraints 
       SET parsed_json=$1, constraint_type=$2, priority=$3, is_active=$4, confirmed_by_user=$5
       WHERE id=$6 RETURNING *`,
      [parsed_json, constraint_type, priority, is_active, confirmed_by_user, id]
    );
    return rows[0];
  },

  async remove(id) {
    await db.query(`DELETE FROM special_constraints WHERE id = $1`, [id]);
  }
};

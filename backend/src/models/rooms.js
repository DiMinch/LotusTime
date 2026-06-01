const db = require('../db/pool');

module.exports = {
  async findAll() {
    const { rows } = await db.query(`SELECT * FROM rooms WHERE is_active = true ORDER BY name`);
    return rows;
  },

  async findById(id) {
    const { rows } = await db.query(`SELECT * FROM rooms WHERE id = $1`, [id]);
    return rows[0];
  },

  async create({ name, capacity }) {
    const { rows } = await db.query(
      `INSERT INTO rooms (name, capacity) VALUES ($1, $2) RETURNING *`,
      [name, capacity]
    );
    return rows[0];
  },

  async update(id, { name, capacity }) {
    const { rows } = await db.query(
      `UPDATE rooms SET name=$1, capacity=$2 WHERE id=$3 RETURNING *`,
      [name, capacity, id]
    );
    return rows[0];
  },

  async remove(id) {
    await db.query(`UPDATE rooms SET is_active = false WHERE id = $1`, [id]);
  }
};

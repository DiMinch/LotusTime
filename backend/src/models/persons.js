const db = require('../db/pool');

module.exports = {
  async findAll() {
    const { rows } = await db.query(`
      SELECT p.*, u.username,
        COALESCE(
          json_agg(DISTINCT pc.capability) FILTER (WHERE pc.capability IS NOT NULL), '[]'
        ) AS capabilities
      FROM persons p
      LEFT JOIN person_capabilities pc ON pc.person_id = p.id
      LEFT JOIN users u ON u.person_id = p.id
      WHERE p.is_active = true
      GROUP BY p.id, u.username
      ORDER BY p.short_name
    `);
    return rows;
  },

  async findById(id) {
    const { rows } = await db.query(`
      SELECT p.*, u.username,
        COALESCE(
          json_agg(DISTINCT pc.capability) FILTER (WHERE pc.capability IS NOT NULL), '[]'
        ) AS capabilities,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('class_id', pcp.class_id, 'allowed_roles', pcp.allowed_roles))
          FILTER (WHERE pcp.class_id IS NOT NULL), '[]'
        ) AS permissions
      FROM persons p
      LEFT JOIN person_capabilities pc ON pc.person_id = p.id
      LEFT JOIN person_class_permissions pcp ON pcp.person_id = p.id
      LEFT JOIN users u ON u.person_id = p.id
      WHERE p.id = $1
      GROUP BY p.id, u.username
    `, [id]);
    return rows[0];
  },

  async create({ full_name, short_name, email, phone, notes }) {
    const { rows } = await db.query(
      `INSERT INTO persons (full_name, short_name, email, phone, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [full_name, short_name, email, phone, notes]
    );
    return rows[0];
  },

  async update(id, { full_name, short_name, email, phone, notes, is_active = true }) {
    const { rows } = await db.query(
      `UPDATE persons SET full_name=$1, short_name=$2, email=$3, phone=$4, notes=$5, is_active=$6
       WHERE id=$7 RETURNING *`,
      [full_name, short_name, email, phone, notes, is_active, id]
    );
    return rows[0];
  },

  async remove(id) {
    await db.query(`UPDATE persons SET is_active = false WHERE id = $1`, [id]);
  },

  async setCapabilities(personId, capabilities) {
    await db.query(`DELETE FROM person_capabilities WHERE person_id = $1`, [personId]);
    if (capabilities && capabilities.length > 0) {
      const values = capabilities.map((c, i) => `($1, $${i + 2})`).join(', ');
      await db.query(
        `INSERT INTO person_capabilities (person_id, capability) VALUES ${values}`,
        [personId, ...capabilities]
      );
    }
  },

  async setPermissions(personId, permissions) {
    // permissions = [{ class_id, allowed_roles: ['lead_teacher'] }, ...]
    await db.query(`DELETE FROM person_class_permissions WHERE person_id = $1`, [personId]);
    for (const perm of permissions) {
      await db.query(
        `INSERT INTO person_class_permissions (person_id, class_id, allowed_roles) VALUES ($1, $2, $3)`,
        [personId, perm.class_id, perm.allowed_roles]
      );
    }
  }
};

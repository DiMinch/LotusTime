const db = require('../db/pool');

module.exports = {
  async findAll() {
    const { rows } = await db.query(`
      SELECT c.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('person_id', pcp.person_id, 'allowed_roles', pcp.allowed_roles))
          FILTER (WHERE pcp.person_id IS NOT NULL), '[]'
        ) AS permissions
      FROM classes c
      LEFT JOIN person_class_permissions pcp ON pcp.class_id = c.id
      WHERE c.is_active = true
      GROUP BY c.id
      ORDER BY c.code
    `);
    return rows;
  },

  async findById(id) {
    const { rows } = await db.query(`
      SELECT c.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('person_id', pcp.person_id, 'allowed_roles', pcp.allowed_roles))
          FILTER (WHERE pcp.person_id IS NOT NULL), '[]'
        ) AS permissions
      FROM classes c
      LEFT JOIN person_class_permissions pcp ON pcp.class_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
    `, [id]);
    return rows[0];
  },

  async create({ code, class_type, level, sessions_per_week, duration_minutes, requires_ta, notes, student_count, segments, allow_same_day }) {
    const { rows } = await db.query(
      `INSERT INTO classes (code, class_type, level, sessions_per_week, duration_minutes, requires_ta, notes, student_count, segments, allow_same_day)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [code, class_type, level, sessions_per_week, duration_minutes, requires_ta, notes,
       student_count || null, segments ? JSON.stringify(segments) : null, allow_same_day || false]
    );
    return rows[0];
  },

  async update(id, { code, class_type, level, sessions_per_week, duration_minutes, requires_ta, notes, student_count, segments, allow_same_day }) {
    const { rows } = await db.query(
      `UPDATE classes SET code=$1, class_type=$2, level=$3, sessions_per_week=$4,
       duration_minutes=$5, requires_ta=$6, notes=$7, student_count=$8, segments=$9, allow_same_day=$10
       WHERE id=$11 RETURNING *`,
      [code, class_type, level, sessions_per_week, duration_minutes, requires_ta, notes,
       student_count || null, segments ? JSON.stringify(segments) : null, allow_same_day || false, id]
    );
    return rows[0];
  },

  async remove(id) {
    await db.query(`UPDATE classes SET is_active = false WHERE id = $1`, [id]);
  },

  async setPermissions(classId, permissions) {
    await db.query(`DELETE FROM person_class_permissions WHERE class_id = $1`, [classId]);
    if (permissions && permissions.length > 0) {
      for (const perm of permissions) {
        await db.query(
          `INSERT INTO person_class_permissions (class_id, person_id, allowed_roles) VALUES ($1, $2, $3)`,
          [classId, perm.person_id, perm.allowed_roles]
        );
      }
    }
  }
};

const db = require('../db/pool');

module.exports = {
  async findAll() {
    const { rows } = await db.query(`
      SELECT u.id, u.username, u.email, u.role, u.google_id, u.is_active, u.person_id, u.created_at, u.is_first_login,
             p.short_name AS person_short_name, p.full_name AS person_full_name
      FROM users u
      LEFT JOIN persons p ON p.id = u.person_id
      ORDER BY u.created_at DESC
    `);
    return rows;
  },

  async findById(id) {
    const { rows } = await db.query(`
      SELECT u.id, u.username, u.email, u.role, u.google_id, u.is_active, u.person_id, u.created_at, u.is_first_login,
             p.short_name AS person_short_name, p.full_name AS person_full_name
      FROM users u
      LEFT JOIN persons p ON p.id = u.person_id
      WHERE u.id = $1
    `, [id]);
    return rows[0];
  },

  async findByUsername(username) {
    const { rows } = await db.query(`
      SELECT u.*, p.short_name AS person_short_name, p.full_name AS person_full_name
      FROM users u
      LEFT JOIN persons p ON p.id = u.person_id
      WHERE LOWER(u.username) = LOWER($1)
    `, [username]);
    return rows[0];
  },

  async findByEmail(email) {
    const { rows } = await db.query(`
      SELECT u.*, p.short_name AS person_short_name, p.full_name AS person_full_name
      FROM users u
      LEFT JOIN persons p ON p.id = u.person_id
      WHERE LOWER(u.email) = LOWER($1)
    `, [email]);
    return rows[0];
  },

  async findByResetTokenHash(tokenHash) {
    const { rows } = await db.query(`
      SELECT * FROM users
      WHERE reset_token_hash = $1 AND reset_token_expires > NOW() AND is_active = true
    `, [tokenHash]);
    return rows[0];
  },

  async create({ username, email, password_hash, role = 'staff', google_id = null, person_id = null, is_first_login = true }) {
    const { rows } = await db.query(`
      INSERT INTO users (username, email, password_hash, role, google_id, person_id, is_first_login)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, username, email, role, google_id, person_id, is_active, is_first_login, created_at
    `, [username, email, password_hash, role, google_id, person_id, is_first_login]);
    return rows[0];
  },

  async update(id, { username, email, password_hash, role, google_id, person_id, is_active, is_first_login }) {
    // Dynamically build the update query to allow updating only provided fields or full object
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const data = { username, email, password_hash, role, google_id, person_id, is_active, is_first_login };
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(val);
        paramIndex++;
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const query = `
      UPDATE users 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING id, username, email, role, google_id, person_id, is_active, is_first_login, created_at
    `;
    
    const { rows } = await db.query(query, values);
    return rows[0];
  },

  async updatePassword(id, passwordHash) {
    await db.query(`
      UPDATE users 
      SET password_hash = $1, reset_token_hash = NULL, reset_token_expires = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [passwordHash, id]);
  },

  async updateResetToken(id, { hash, expires }) {
    await db.query(`
      UPDATE users 
      SET reset_token_hash = $1, reset_token_expires = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [hash, expires, id]);
  },

  async remove(id) {
    await db.query('UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
  }
};

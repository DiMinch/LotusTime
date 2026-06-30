const Person = require('../models/persons');
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendAccountCredentialsEmail } = require('../services/emailService');

exports.list = async (req, res, next) => {
  try {
    const persons = await Person.findAll();
    res.json(persons);
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const person = await Person.findById(req.params.id);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json(person);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const db = require('../db/pool');
    const { short_name, username, email } = req.body;
    
    if (!username || !username.trim()) {
      return res.status(400).json({
        error: 'MissingUsername',
        message: 'Tên đăng nhập hệ thống là bắt buộc.'
      });
    }

    // Check if person short_name exists
    const { rows } = await db.query(
      'SELECT * FROM persons WHERE LOWER(short_name) = LOWER($1)',
      [short_name]
    );

    if (rows.length > 0) {
      const existing = rows[0];
      if (!existing.is_active) {
        return res.status(400).json({
          error: 'InactiveDuplicate',
          message: 'Tên viết tắt này đã tồn tại dưới dạng đã xóa.',
          person: existing
        });
      } else {
        return res.status(400).json({
          error: 'DuplicateKey',
          message: 'Tên viết tắt của giáo viên/TA này đã tồn tại.'
        });
      }
    }

    // Check if system username already exists
    const existingUser = await User.findByUsername(username.trim());
    if (existingUser) {
      return res.status(400).json({
        error: 'UsernameExists',
        message: 'Tên đăng nhập hệ thống đã tồn tại.'
      });
    }

    // Check if system email already exists
    if (email && email.trim()) {
      const existingEmail = await User.findByEmail(email.trim());
      if (existingEmail) {
        return res.status(400).json({
          error: 'EmailExists',
          message: 'Địa chỉ email đã được sử dụng bởi một tài khoản khác.'
        });
      }
    }

    // 1. Create Person record
    const person = await Person.create(req.body);
    if (req.body.capabilities) {
      await Person.setCapabilities(person.id, req.body.capabilities);
    }

    // 2. Auto-generate secure 8-character temporary password
    const rawPassword = Math.random().toString(36).substring(2, 10);
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    // 3. Create User account linked 1:1 to Person
    const dummyEmail = `${username.trim().toLowerCase()}@lotustime.local`;
    await User.create({
      username: username.trim(),
      email: email && email.trim() ? email.trim() : dummyEmail,
      password_hash: passwordHash,
      role: 'staff',
      person_id: person.id,
      is_first_login: true
    });

    // Log to console for development convenience
    console.log(`\n==================================================`);
    console.log(`[USER CREATED] Username: ${username.trim()} | Temp Password: ${rawPassword}`);
    console.log(`==================================================\n`);

    // 4. Send credentials email
    if (email && email.trim().includes('@')) {
      try {
        await sendAccountCredentialsEmail(email.trim(), username.trim(), rawPassword);
      } catch (mailErr) {
        console.error('Failed to send credentials email:', mailErr);
      }
    }

    const createdPerson = await Person.findById(person.id);
    res.status(201).json({
      ...createdPerson,
      temp_password: rawPassword
    });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const person = await Person.update(req.params.id, req.body);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    
    // Sync email to users table if modified
    if (req.body.email !== undefined) {
      const db = require('../db/pool');
      const emailVal = req.body.email && req.body.email.trim()
        ? req.body.email.trim()
        : `${person.short_name.toLowerCase()}@lotustime.local`;
      await db.query(
        'UPDATE users SET email = $1 WHERE person_id = $2',
        [emailVal, req.params.id]
      );
    }

    // Sync account status (is_active) to users table if modified
    if (req.body.is_active !== undefined) {
      const db = require('../db/pool');
      await db.query(
        'UPDATE users SET is_active = $1 WHERE person_id = $2',
        [req.body.is_active, req.params.id]
      );
    }

    res.json(person);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const db = require('../db/pool');
    await Person.remove(req.params.id);
    
    // Deactivate the associated system user account
    await db.query('UPDATE users SET is_active = false WHERE person_id = $1', [req.params.id]);

    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

exports.setCapabilities = async (req, res, next) => {
  try {
    await Person.setCapabilities(req.params.id, req.body.capabilities);
    res.json(await Person.findById(req.params.id));
  } catch (err) { next(err); }
};

exports.setPermissions = async (req, res, next) => {
  try {
    await Person.setPermissions(req.params.id, req.body.permissions);
    res.json(await Person.findById(req.params.id));
  } catch (err) { next(err); }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const personId = req.params.id;
    const db = require('../db/pool');
    
    // Check if there is a linked user account
    const { rows: [user] } = await db.query(
      'SELECT u.*, p.short_name, p.email FROM users u JOIN persons p ON p.id = u.person_id WHERE u.person_id = $1',
      [personId]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'UserAccountNotFound', message: 'Giáo viên này chưa có tài khoản hệ thống.' });
    }
    
    // Generate new random password
    const rawPassword = crypto.randomBytes(4).toString('hex'); // 8 characters
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    
    // Update password and set is_first_login = true
    await db.query(
      'UPDATE users SET password_hash = $1, is_first_login = true WHERE id = $2',
      [passwordHash, user.id]
    );
    
    // Send email notification if they have a real email and it's not local
    if (user.email && user.email.trim().includes('@') && !user.email.endsWith('@lotustime.local')) {
      try {
        await sendAccountCredentialsEmail(user.email.trim(), user.username, rawPassword);
      } catch (mailErr) {
        console.error('Failed to send reset credentials email:', mailErr);
      }
    }
    
    // Log to console for dev environment
    console.log(`\n==================================================`);
    console.log(`[PASSWORD RESET] Username: ${user.username} | New Temp Password: ${rawPassword}`);
    console.log(`==================================================\n`);
    
    res.json({
      username: user.username,
      temp_password: rawPassword,
      email: user.email || '(Không có)'
    });
  } catch (err) { next(err); }
};

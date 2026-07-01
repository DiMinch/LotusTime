const bcrypt = require('bcryptjs');
const User = require('../models/user');

module.exports = {
  async list(req, res, next) {
    try {
      const users = await User.findAll();
      res.json(users);
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const { username, email, password, role, person_id } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'MissingFields', message: 'Tên đăng nhập, email và mật khẩu là bắt buộc.' });
      }

      // Check if username already exists
      const existingUser = await User.findByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: 'UsernameExists', message: 'Tên đăng nhập đã tồn tại.' });
      }

      // Check if email already exists
      const existingEmail = await User.findByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ error: 'EmailExists', message: 'Địa chỉ email đã tồn tại.' });
      }

            const passwordHash = await bcrypt.hash(password, 10);
      
      let resolvedPersonId = person_id || null;
      if (!resolvedPersonId && email) {
        const db = require('../db/pool');
        const { rows: pRows } = await db.query(
          'SELECT id FROM persons WHERE LOWER(email) = LOWER($1) AND is_active = true LIMIT 1',
          [email]
        );
        if (pRows.length > 0) {
          resolvedPersonId = pRows[0].id;
        }
      }

      const newUser = await User.create({
        username,
        email,
        password_hash: passwordHash,
        role,
        person_id: resolvedPersonId
      });

      res.status(201).json(newUser);
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const { username, email, role, person_id } = req.body;
      const userId = req.params.id;

      // Validate uniqueness if username is changed
      if (username) {
        const u = await User.findByUsername(username);
        if (u && u.id !== userId) {
          return res.status(400).json({ error: 'UsernameExists', message: 'Tên đăng nhập đã tồn tại.' });
        }
      }

      // Validate uniqueness if email is changed
      if (email) {
        const u = await User.findByEmail(email);
        if (u && u.id !== userId) {
          return res.status(400).json({ error: 'EmailExists', message: 'Địa chỉ email đã tồn tại.' });
        }
      }

      let resolvedPersonId = person_id || null;
      if (!resolvedPersonId && email) {
        const db = require('../db/pool');
        const { rows: pRows } = await db.query(
          'SELECT id FROM persons WHERE LOWER(email) = LOWER($1) AND is_active = true LIMIT 1',
          [email]
        );
        if (pRows.length > 0) {
          resolvedPersonId = pRows[0].id;
        }
      }

      const updatedUser = await User.update(userId, {
        username,
        email,
        role,
        person_id: resolvedPersonId
      });

      res.json(updatedUser);
    } catch (err) { next(err); }
  },

  async resetPassword(req, res, next) {
    try {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: 'MissingPassword', message: 'Mật khẩu mới là bắt buộc.' });
      }

      const targetUser = await User.findById(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ error: 'UserNotFound', message: 'Người dùng không tồn tại.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await User.updatePassword(req.params.id, passwordHash);

      // Trigger Email Notification
      if (targetUser.email) {
        const { sendMail } = require('../services/emailService');
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #e52020; border-bottom: 2px solid #e52020; padding-bottom: 10px;">Đặt lại mật khẩu tài khoản</h2>
            <p>Xin chào <strong>${targetUser.username}</strong>,</p>
            <p>Mật khẩu tài khoản LotusTime của bạn đã được quản trị viên đặt lại thành công.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; width: 150px;">Tên đăng nhập:</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;"><code>${targetUser.username}</code></td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Mật khẩu mới:</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;"><code>${password}</code></td>
              </tr>
            </table>
            <p style="color: #e52020; font-weight: bold;">Lưu ý: Bạn nên sử dụng mật khẩu này đăng nhập và đổi mật khẩu cá nhân ngay để đảm bảo an toàn.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #777; text-align: center;">Đây là email tự động từ hệ thống LotusTime, vui lòng không trả lời email này.</p>
          </div>
        `;
        try {
          await sendMail({
            to: targetUser.email,
            subject: '[LotusTime] Mật khẩu của bạn đã được đặt lại',
            html: emailHtml
          });
        } catch (emailErr) {
          console.error(`[Notification] Failed to send password reset email:`, emailErr.message);
        }
      }

      res.json({ success: true, message: 'Đặt lại mật khẩu thành công.' });
    } catch (err) { next(err); }
  },

  async toggleStatus(req, res, next) {
    try {
      const { is_active } = req.body;
      if (is_active === undefined) {
        return res.status(400).json({ error: 'MissingStatus', message: 'Trạng thái hoạt động là bắt buộc.' });
      }

      const updatedUser = await User.update(req.params.id, { is_active });
      res.json(updatedUser);
    } catch (err) { next(err); }
  },

  async remove(req, res, next) {
    try {
      await User.remove(req.params.id);
      res.json({ success: true, message: 'Đã xóa người dùng thành công.' });
    } catch (err) { next(err); }
  }
};

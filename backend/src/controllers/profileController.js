const bcrypt = require('bcryptjs');
const User = require('../models/user');

module.exports = {
  async get(req, res, next) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'UserNotFound', message: 'Không tìm thấy tài khoản.' });
      }
      res.json(user);
    } catch (err) { next(err); }
  },

  async changePassword(req, res, next) {
    try {
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'MissingFields', message: 'Mật khẩu cũ và mật khẩu mới là bắt buộc.' });
      }

      // Load full user details including password_hash
      const user = await User.findByUsername(req.user.username);
      if (!user) {
        return res.status(404).json({ error: 'UserNotFound', message: 'Không tìm thấy tài khoản.' });
      }

      // Verify old password
      const match = await bcrypt.compare(oldPassword, user.password_hash);
      if (!match) {
        return res.status(400).json({ error: 'InvalidOldPassword', message: 'Mật khẩu cũ không chính xác.' });
      }

      // Hash and update new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      await User.updatePassword(user.id, newPasswordHash);
      await User.update(user.id, { is_first_login: false });

      res.json({ success: true, message: 'Đổi mật khẩu thành công.' });
    } catch (err) { next(err); }
  }
};

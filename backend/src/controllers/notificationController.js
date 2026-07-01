const db = require('../db/pool');
const { DEFAULT_SETTINGS } = require('../services/notificationService');

module.exports = {
  // 1. Get user notifications with cursor-based pagination
  async getUserNotifications(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const { cursor_created_at, cursor_id } = req.query;
      const userId = req.user.id;

      let query = `
        SELECT n.*, u.username as actor_username, p.full_name as actor_full_name
        FROM notifications n
        LEFT JOIN users u ON u.id = n.actor_id
        LEFT JOIN persons p ON p.id = u.person_id
        WHERE n.recipient_id = $1
      `;
      const params = [userId];

      if (cursor_created_at && cursor_id) {
        query += ` AND (n.created_at, n.id) < ($2, $3)`;
        params.push(cursor_created_at, cursor_id);
      }

      query += ` ORDER BY n.created_at DESC, n.id DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const { rows: notifications } = await db.query(query, params);

      let nextCursor = null;
      if (notifications.length === limit) {
        const lastItem = notifications[notifications.length - 1];
        nextCursor = {
          created_at: lastItem.created_at,
          id: lastItem.id
        };
      }

      res.json({ notifications, nextCursor });
    } catch (err) { next(err); }
  },

  // 2. Get count of unread notifications
  async getUnreadCount(req, res, next) {
    try {
      const userId = req.user.id;
      const { rows } = await db.query(
        `SELECT COUNT(*)::int as count FROM notifications WHERE recipient_id = $1 AND is_read = false`,
        [userId]
      );
      res.json({ count: rows[0].count });
    } catch (err) { next(err); }
  },

  // 3. Mark single notification as read
  async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const { rows } = await db.query(
        `UPDATE notifications SET is_read = true 
         WHERE id = $1 AND recipient_id = $2 RETURNING *`,
        [id, userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'NotFound', message: 'Thông báo không tồn tại hoặc bạn không có quyền.' });
      }

      res.json({ success: true, notification: rows[0] });
    } catch (err) { next(err); }
  },

  // 4. Mark all notifications as read
  async markAllAsRead(req, res, next) {
    try {
      const userId = req.user.id;
      await db.query(
        `UPDATE notifications SET is_read = true WHERE recipient_id = $1`,
        [userId]
      );
      res.json({ success: true, message: 'Đã đánh dấu đọc tất cả thông báo.' });
    } catch (err) { next(err); }
  },

  // 5. Get notification settings
  async getSettings(req, res, next) {
    try {
      const userId = req.user.id;
      const { rows } = await db.query(
        `SELECT settings FROM notification_settings WHERE user_id = $1`,
        [userId]
      );

      const settings = rows.length > 0 ? rows[0].settings : DEFAULT_SETTINGS;
      res.json(settings);
    } catch (err) { next(err); }
  },

  // 6. Update notification settings
  async updateSettings(req, res, next) {
    try {
      const userId = req.user.id;
      const { settings } = req.body;

      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ error: 'InvalidSettings', message: 'Cấu hình không hợp lệ.' });
      }

      const { rows } = await db.query(
        `INSERT INTO notification_settings (user_id, settings, updated_at) 
         VALUES ($1, $2, now()) 
         ON CONFLICT (user_id) 
         DO UPDATE SET settings = EXCLUDED.settings, updated_at = now() 
         RETURNING *`,
        [userId, JSON.stringify(settings)]
      );

      res.json({ success: true, settings: rows[0].settings });
    } catch (err) { next(err); }
  }
};

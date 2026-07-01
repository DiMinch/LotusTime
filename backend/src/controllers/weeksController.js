const Week = require('../models/weeks');
const db = require('../db/pool');
const { dispatchNotification } = require('../services/notificationService');

exports.list = async (req, res, next) => {
  try { res.json(await Week.findAll()); } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const week = await Week.findById(req.params.id);
    if (!week) return res.status(404).json({ error: 'Week not found' });
    res.json(week);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try { res.status(201).json(await Week.create(req.body)); } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const weekId = req.params.id;
    const week = await Week.updateStatus(weekId, status);
    if (!week) return res.status(404).json({ error: 'Week not found' });

    if (status === 'published') {
      const { rows: assignedUsers } = await db.query(
        `SELECT DISTINCT u.id, p.full_name, u.email 
         FROM session_assignments sa 
         JOIN sessions s ON s.id = sa.session_id 
         JOIN users u ON u.person_id = sa.person_id 
         LEFT JOIN persons p ON p.id = u.person_id
         WHERE s.week_id = $1`,
        [weekId]
      );
      
      const formattedDate = new Date(week.week_start).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      const actorId = req.user ? req.user.id : null;

      for (const user of assignedUsers) {
        await dispatchNotification({
          recipientId: user.id,
          actorId,
          type: 'SCH_PUB',
          title: 'Thời khóa biểu mới đã được xuất bản',
          content: `Thời khóa biểu tuần từ ngày ${formattedDate} đã được xuất bản. Hãy kiểm tra lịch dạy của bạn!`,
          targetUrl: `/schedule?week=${weekId}`
        });
      }
    }

    res.json(week);
  } catch (err) { next(err); }
};

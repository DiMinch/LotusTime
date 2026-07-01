const db = require('../db');
const { sendMail } = require('./emailService');

const DEFAULT_SETTINGS = {
  SCH_PUB: { email: true, inapp: true },
  SES_UPD: { email: true, inapp: true },
  SUB_REQ: { email: true, inapp: true },
  ATT_APP: { email: false, inapp: true },
  ATT_REJ: { email: true, inapp: true }
};

/**
 * Dispatch a notification to a specific recipient.
 */
async function dispatchNotification({ recipientId, actorId = null, type, title, content, targetUrl = null }) {
  try {
    // 1. Get recipient info and settings
    const { rows } = await db.query(
      `SELECT u.email, u.username, ns.settings 
       FROM users u 
       LEFT JOIN notification_settings ns ON ns.user_id = u.id 
       WHERE u.id = $1`,
      [recipientId]
    );

    if (rows.length === 0) {
      console.warn(`[Notification] Recipient ${recipientId} not found.`);
      return;
    }

    const recipient = rows[0];
    const userSettings = recipient.settings || DEFAULT_SETTINGS;
    const typeSetting = userSettings[type] || DEFAULT_SETTINGS[type] || { email: false, inapp: true };

    // 2. Handle In-app dispatch
    if (typeSetting.inapp) {
      await db.query(
        `INSERT INTO notifications (recipient_id, actor_id, type, title, content, target_url) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [recipientId, actorId, type, title, content, targetUrl]
      );
      console.log(`[Notification] In-app notification created for ${recipient.username}`);
    }

    // 3. Handle Email dispatch
    if (typeSetting.email && recipient.email) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #76b900; border-bottom: 2px solid #76b900; padding-bottom: 10px;">${title}</h2>
          <p>Xin chào <strong>${recipient.username}</strong>,</p>
          <p>${content.replace(/\n/g, '<br>')}</p>
          ${targetUrl ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}${targetUrl}" 
               style="background-color: #76b900; color: #000; padding: 12px 25px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
               Xem chi tiết
            </a>
          </div>` : ''}
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="font-size: 12px; color: #777; text-align: center;">Đây là email tự động từ hệ thống LotusTime, vui lòng không trả lời email này.</p>
        </div>
      `;

      try {
        await sendMail({
          to: recipient.email,
          subject: `[LotusTime] ${title}`,
          html: emailHtml
        });
        console.log(`[Notification] Email sent to ${recipient.email}`);
      } catch (emailErr) {
        console.error(`[Notification] Failed to send email to ${recipient.email}:`, emailErr.message);
      }
    }
  } catch (err) {
    console.error(`[Notification] Error dispatching notification:`, err.message);
  }
}

module.exports = {
  dispatchNotification,
  DEFAULT_SETTINGS
};

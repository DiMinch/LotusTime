const crypto = require('crypto');
const db = require('../db/pool');
const redisClient = require('../db/redis');

const SECRET_KEY = process.env.JWT_SECRET || 'lotustime_jwt_secret_key_2026_secure';

// Helper: Haversine Formula to calculate distance in meters between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

module.exports = {
  // 1. Admin: Generate Universal Dynamic QR Token
  async generateQR(req, res, next) {
    try {
      const { branchId } = req.query;
      if (!branchId) {
        return res.status(400).json({ error: 'MissingFields', message: 'Vui lòng chọn chi nhánh để tạo mã QR.' });
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = crypto.randomBytes(16).toString('hex');
      
      // Generate HMAC signature
      const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(`${branchId}:${timestamp}:${nonce}`)
        .digest('hex');

      const token = `${branchId}:${timestamp}:${nonce}:${signature}`;

      // Save nonce to Redis with 15s TTL (mark as unused)
      await redisClient.set(`qr_nonce:${nonce}`, 'unused', { EX: 15 });

      res.json({
        token,
        expiresIn: 15
      });
    } catch (err) { next(err); }
  },

  // 2. Public/Staff/Admin: List all branches
  async getBranches(req, res, next) {
    try {
      const { rows } = await db.query('SELECT * FROM branches ORDER BY name');
      res.json(rows);
    } catch (err) { next(err); }
  },

  // 3. Staff/Admin: Get current check-in status and any pending auto-closed logs needing declaration
  async getStatus(req, res, next) {
    try {
      const userId = req.user.id;

      // Find active check-in
      const { rows: activeRows } = await db.query(
        `SELECT l.*, b.name as branch_name 
         FROM attendance_logs l 
         LEFT JOIN branches b ON b.id = l.branch_id 
         WHERE l.user_id = $1 AND l.status = 'active' 
         ORDER BY l.check_in_time DESC LIMIT 1`,
        [userId]
      );
      const activeLog = activeRows[0] || null;

      // Find auto_closed logs that DO NOT have declared sessions
      const { rows: pendingRows } = await db.query(
        `SELECT l.*, b.name as branch_name 
         FROM attendance_logs l 
         LEFT JOIN branches b ON b.id = l.branch_id 
         WHERE l.user_id = $1 AND l.status = 'auto_closed' 
           AND NOT EXISTS (
             SELECT 1 FROM attendance_declared_sessions s WHERE s.attendance_log_id = l.id
           )
         ORDER BY l.check_in_time DESC`,
        [userId]
      );

      res.json({
        activeLog,
        pendingDeclarations: pendingRows
      });
    } catch (err) { next(err); }
  },

  // 4. Staff/Admin: Scan QR code to Check-In or Check-Out
  async scanQR(req, res, next) {
    try {
      const { token, lat, lng } = req.body;
      const userId = req.user.id;
      const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      if (!token) {
        return res.status(400).json({ error: 'MissingFields', message: 'Vui lòng cung cấp mã QR.' });
      }

      // Deconstruct token: branchId:timestamp:nonce:signature
      const parts = token.split(':');
      if (parts.length !== 4) {
        return res.status(400).json({ error: 'InvalidQR', message: 'Mã QR không hợp lệ.' });
      }

      const [branchId, timestampStr, nonce, signature] = parts;
      const timestamp = parseInt(timestampStr, 10);

      // A. Verify Signature
      const expectedSignature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(`${branchId}:${timestampStr}:${nonce}`)
        .digest('hex');

      if (signature !== expectedSignature) {
        return res.status(400).json({ error: 'InvalidQR', message: 'Mã QR không hợp lệ hoặc đã bị chỉnh sửa.' });
      }

      // B. Verify Expiration (15 seconds + 15 seconds network skew allowance)
      const currentTimestamp = Math.floor(Date.now() / 1000);
      if (currentTimestamp - timestamp > 30) {
        return res.status(400).json({ error: 'QRExpired', message: 'Mã QR đã hết hạn. Vui lòng quét mã mới trên màn hình.' });
      }

      // C. Verify Redis Nonce to prevent Replay Attack
      const nonceStatus = await redisClient.get(`qr_nonce:${nonce}`);
      if (!nonceStatus || nonceStatus !== 'unused') {
        return res.status(400).json({ error: 'QRAlreadyUsed', message: 'Mã QR này đã được sử dụng. Vui lòng quét mã mới vừa tạo.' });
      }

      // Mark as used immediately to invalidate
      await redisClient.set(`qr_nonce:${nonce}`, 'used', { EX: 15 });

      // D. Verify GPS Coordinates (Warning only)
      const { rows: branchRows } = await db.query('SELECT * FROM branches WHERE id = $1', [branchId]);
      if (branchRows.length === 0) {
        return res.status(404).json({ error: 'BranchNotFound', message: 'Không tìm thấy chi nhánh này trên hệ thống.' });
      }
      const branch = branchRows[0];

      let gpsValid = true;
      if (lat && lng) {
        const distance = calculateDistance(parseFloat(lat), parseFloat(lng), branch.latitude, branch.longitude);
        if (distance > branch.allowed_radius_meters) {
          gpsValid = false;
        }
      } else {
        gpsValid = false; // Missing coordinates is flagged as warning
      }

      // E. State check: Active check-in logs
      const { rows: activeRows } = await db.query(
        `SELECT * FROM attendance_logs WHERE user_id = $1 AND status = 'active' ORDER BY check_in_time DESC LIMIT 1`,
        [userId]
      );
      const activeLog = activeRows[0];

      if (activeLog) {
        // CASE: CHECK-OUT
        const { rows: updatedRows } = await db.query(
          `UPDATE attendance_logs 
           SET check_out_time = CURRENT_TIMESTAMP, 
               check_out_lat = $1, 
               check_out_lng = $2, 
               check_out_gps_valid = $3, 
               ip_address = $4,
               status = 'completed', 
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = $5 RETURNING *`,
          [lat || null, lng || null, gpsValid, ipAddress, activeLog.id]
        );
        return res.json({
          action: 'CHECK_OUT',
          message: 'Check-out thành công! Vui lòng khai báo các ca dạy của bạn.',
          log: updatedRows[0]
        });
      } else {
        // CASE: CHECK-IN
        // Auto-close any historical open sessions older than 12 hours
        await db.query(
          `UPDATE attendance_logs 
           SET status = 'auto_closed', 
               updated_at = CURRENT_TIMESTAMP 
           WHERE user_id = $1 AND status = 'active' 
             AND check_in_time < NOW() - INTERVAL '12 hours'`,
          [userId]
        );

        const { rows: insertedRows } = await db.query(
          `INSERT INTO attendance_logs 
             (user_id, branch_id, check_in_time, check_in_lat, check_in_lng, check_in_gps_valid, ip_address, status) 
           VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, 'active') 
           RETURNING *`,
          [userId, branchId, lat || null, lng || null, gpsValid, ipAddress]
        );

        return res.json({
          action: 'CHECK_IN',
          message: 'Check-in thành công!',
          log: insertedRows[0]
        });
      }
    } catch (err) { next(err); }
  },

  // 5. Staff/Admin: Declare sessions for an attendance log (is_approved = false by default)
  async declareSessions(req, res, next) {
    try {
      const { attendance_log_id, sessions } = req.body;
      const userId = req.user.id;

      if (!attendance_log_id || !Array.isArray(sessions) || sessions.length === 0) {
        return res.status(400).json({ error: 'MissingFields', message: 'Vui lòng cung cấp đầy đủ thông tin ca dạy.' });
      }

      // Check log exists and belongs to user
      const { rows: logRows } = await db.query(
        `SELECT l.*, b.rate_ta_ielts, b.rate_ta_kids, b.rate_ta_independent, b.rate_ta_support 
         FROM attendance_logs l 
         LEFT JOIN branches b ON b.id = l.branch_id
         WHERE l.id = $1 AND l.user_id = $2`,
        [attendance_log_id, userId]
      );

      if (logRows.length === 0) {
        return res.status(404).json({ error: 'LogNotFound', message: 'Không tìm thấy ca làm việc.' });
      }
      const log = logRows[0];

      // Delete existing declared sessions for this log if any (overwrite support)
      await db.query('DELETE FROM attendance_declared_sessions WHERE attendance_log_id = $1', [attendance_log_id]);

      for (const s of sessions) {
        const { ta_capability, start_time, end_time } = s;
        if (!ta_capability || !start_time || !end_time) {
          return res.status(400).json({ error: 'InvalidSessionData', message: 'Thông tin ca dạy không hợp lệ.' });
        }

        // Calculate hours duration
        const [sh, sm] = start_time.split(':').map(Number);
        const [eh, em] = end_time.split(':').map(Number);
        let durationMinutes = (eh * 60 + em) - (sh * 60 + sm);
        if (durationMinutes < 0) durationMinutes += 24 * 60; // Over-midnight support
        const durationHours = parseFloat((durationMinutes / 60).toFixed(2));

        // Fetch capability rate
        let rate = 0;
        switch (ta_capability) {
          case 'TA_IELTS': rate = log.rate_ta_ielts || 50000; break;
          case 'TA_KIDS': rate = log.rate_ta_kids || 45000; break;
          case 'TA_INDEPENDENT': rate = log.rate_ta_independent || 60000; break;
          case 'TA_SUPPORT': rate = log.rate_ta_support || 40000; break;
          default: rate = 40000;
        }

        const totalPay = Math.round(durationHours * rate);

        await db.query(
          `INSERT INTO attendance_declared_sessions 
             (attendance_log_id, ta_capability, start_time, end_time, duration_hours, snapshot_hourly_rate, total_pay, is_approved) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, false)`,
          [attendance_log_id, ta_capability, start_time, end_time, durationHours, rate, totalPay]
        );
      }

      res.json({ success: true, message: 'Khai báo các ca dạy thành công, đang chờ Admin phê duyệt.' });
    } catch (err) { next(err); }
  },

  // 6. Staff/Admin: Submit attendance claim for forgotten check-in/out
  async submitClaim(req, res, next) {
    try {
      const { branch_id, claim_date, claimed_check_in, claimed_check_out, reason } = req.body;
      const userId = req.user.id;

      if (!branch_id || !claim_date || !claimed_check_in || !claimed_check_out || !reason) {
        return res.status(400).json({ error: 'MissingFields', message: 'Vui lòng cung cấp đầy đủ thông tin khiếu nại bù công.' });
      }

      const { rows } = await db.query(
        `INSERT INTO attendance_claims 
           (user_id, branch_id, claim_date, claimed_check_in, claimed_check_out, reason, status) 
         VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
        [userId, branch_id, claim_date, claimed_check_in, claimed_check_out, reason]
      );

      res.json({ success: true, claim: rows[0], message: 'Đã gửi yêu cầu bổ sung công thành công.' });
    } catch (err) { next(err); }
  },

  // 7. Staff/Admin: View history of logs, declared sessions, and claims
  async getMyLogs(req, res, next) {
    try {
      const userId = req.user.id;

      // Get attendance logs with declared sessions nested
      const { rows: logs } = await db.query(
        `SELECT l.*, b.name as branch_name,
           COALESCE(
             json_agg(
               jsonb_build_object(
                 'id', s.id,
                 'ta_capability', s.ta_capability,
                 'start_time', s.start_time,
                 'end_time', s.end_time,
                 'duration_hours', s.duration_hours,
                 'snapshot_hourly_rate', s.snapshot_hourly_rate,
                 'total_pay', s.total_pay,
                 'is_approved', s.is_approved,
                 'admin_notes', s.admin_notes
               )
             ) FILTER (WHERE s.id IS NOT NULL), '[]'
           ) AS declared_sessions
         FROM attendance_logs l 
         LEFT JOIN branches b ON b.id = l.branch_id 
         LEFT JOIN attendance_declared_sessions s ON s.attendance_log_id = l.id
         WHERE l.user_id = $1 
         GROUP BY l.id, b.name
         ORDER BY l.check_in_time DESC`,
        [userId]
      );

      // Get claims
      const { rows: claims } = await db.query(
        `SELECT c.*, b.name as branch_name 
         FROM attendance_claims c 
         LEFT JOIN branches b ON b.id = c.branch_id 
         WHERE c.user_id = $1 
         ORDER BY c.claim_date DESC`,
        [userId]
      );

      res.json({ logs, claims });
    } catch (err) { next(err); }
  },

  // 8. Admin: Get all declared sessions pending approval
  async adminGetPending(req, res, next) {
    try {
      const { rows } = await db.query(
        `SELECT s.*, l.check_in_time, l.check_out_time, u.username, 
                p.full_name as person_full_name, b.name as branch_name 
         FROM attendance_declared_sessions s 
         JOIN attendance_logs l ON l.id = s.attendance_log_id 
         JOIN users u ON u.id = l.user_id 
         LEFT JOIN persons p ON p.id = u.person_id 
         LEFT JOIN branches b ON b.id = l.branch_id 
         WHERE s.is_approved = false 
         ORDER BY s.created_at DESC`
      );
      res.json(rows);
    } catch (err) { next(err); }
  },

  // 9. Admin: Approve/Reject declared session
  async adminApproveSession(req, res, next) {
    try {
      const { id } = req.params;
      const { is_approved, admin_notes } = req.body;

      if (is_approved === undefined) {
        return res.status(400).json({ error: 'MissingFields', message: 'Vui lòng điền trạng thái phê duyệt.' });
      }

      const { rows } = await db.query(
        `UPDATE attendance_declared_sessions 
         SET is_approved = $1, admin_notes = $2 
         WHERE id = $3 RETURNING *`,
        [is_approved, admin_notes || null, id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'SessionNotFound', message: 'Không tìm thấy ca dạy cần duyệt.' });
      }

      res.json({ success: true, session: rows[0], message: 'Đã cập nhật trạng thái phê duyệt ca dạy.' });
    } catch (err) { next(err); }
  },

  // 10. Admin: Get pending claims
  async adminGetClaims(req, res, next) {
    try {
      const { rows } = await db.query(
        `SELECT c.*, u.username, p.full_name as person_full_name, b.name as branch_name 
         FROM attendance_claims c 
         JOIN users u ON u.id = c.user_id 
         LEFT JOIN persons p ON p.id = u.person_id 
         LEFT JOIN branches b ON b.id = c.branch_id 
         WHERE c.status = 'pending' 
         ORDER BY c.created_at DESC`
      );
      res.json(rows);
    } catch (err) { next(err); }
  },

  // 11. Admin: Resolve a claim
  async adminResolveClaim(req, res, next) {
    try {
      const { id } = req.params;
      const { status, admin_notes } = req.body; // 'approved' or 'rejected'
      const adminId = req.user.id;

      if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'InvalidStatus', message: 'Trạng thái giải quyết không hợp lệ.' });
      }

      // Check claim exists
      const { rows: claimRows } = await db.query('SELECT * FROM attendance_claims WHERE id = $1', [id]);
      if (claimRows.length === 0) {
        return res.status(404).json({ error: 'ClaimNotFound', message: 'Không tìm thấy đơn khiếu nại.' });
      }
      const claim = claimRows[0];

      if (claim.status !== 'pending') {
        return res.status(400).json({ error: 'AlreadyResolved', message: 'Đơn khiếu nại này đã được giải quyết.' });
      }

      // Update claim
      await db.query(
        `UPDATE attendance_claims 
         SET status = $1, admin_notes = $2, resolved_by = $3, resolved_at = CURRENT_TIMESTAMP 
         WHERE id = $4`,
        [status, admin_notes || null, adminId, id]
      );

      // If approved, create the attendance_logs record
      let createdLog = null;
      if (status === 'approved') {
        const { rows: logRows } = await db.query(
          `INSERT INTO attendance_logs 
             (user_id, branch_id, check_in_time, check_out_time, check_in_gps_valid, check_out_gps_valid, status) 
           VALUES ($1, $2, $3, $4, true, true, 'completed') RETURNING *`,
          [claim.user_id, claim.branch_id, claim.claimed_check_in, claim.claimed_check_out]
        );
        createdLog = logRows[0];
      }

      res.json({ 
        success: true, 
        message: `Đã ${status === 'approved' ? 'duyệt' : 'từ chối'} đơn khiếu nại thành công.`,
        createdLog
      });
    } catch (err) { next(err); }
  },

  // 12. Admin: Get Payroll Report based on date range, branchId, and capability filter
  async adminGetPayroll(req, res, next) {
    try {
      const { startDate, endDate, branchId } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'MissingFields', message: 'Vui lòng cung cấp khoảng thời gian xem bảng lương.' });
      }

      let query = 
        `SELECT s.*, l.check_in_time, l.check_out_time, u.username, 
                p.full_name as person_full_name, b.name as branch_name 
         FROM attendance_declared_sessions s 
         JOIN attendance_logs l ON l.id = s.attendance_log_id 
         JOIN users u ON u.id = l.user_id 
         LEFT JOIN persons p ON p.id = u.person_id 
         LEFT JOIN branches b ON b.id = l.branch_id 
         WHERE s.is_approved = true 
           AND l.check_in_time >= $1::timestamp 
           AND l.check_in_time <= $2::timestamp`;
      
      const params = [startDate + ' 00:00:00', endDate + ' 23:59:59'];

      if (branchId) {
        query += ' AND l.branch_id = $3';
        params.push(branchId);
      }

      query += ' ORDER BY u.username, l.check_in_time';

      const { rows } = await db.query(query, params);
      res.json(rows);
    } catch (err) { next(err); }
  },

  // 13. Admin: Branches CRUD APIs
  async adminListBranches(req, res, next) {
    try {
      const { rows } = await db.query('SELECT * FROM branches ORDER BY name');
      res.json(rows);
    } catch (err) { next(err); }
  },

  async adminCreateBranch(req, res, next) {
    try {
      const { name, latitude, longitude, allowed_radius_meters, rate_ta_ielts, rate_ta_kids, rate_ta_independent, rate_ta_support } = req.body;
      if (!name || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'MissingFields', message: 'Vui lòng cung cấp đầy đủ thông tin chi nhánh.' });
      }

      const { rows } = await db.query(
        `INSERT INTO branches 
           (name, latitude, longitude, allowed_radius_meters, rate_ta_ielts, rate_ta_kids, rate_ta_independent, rate_ta_support) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [name, latitude, longitude, allowed_radius_meters || 50, rate_ta_ielts || 50000, rate_ta_kids || 45000, rate_ta_independent || 60000, rate_ta_support || 40000]
      );
      res.json({ success: true, branch: rows[0], message: 'Tạo chi nhánh mới thành công.' });
    } catch (err) { next(err); }
  },

  async adminUpdateBranch(req, res, next) {
    try {
      const { id } = req.params;
      const { name, latitude, longitude, allowed_radius_meters, rate_ta_ielts, rate_ta_kids, rate_ta_independent, rate_ta_support } = req.body;

      if (!name || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'MissingFields', message: 'Vui lòng cung cấp đầy đủ thông tin chi nhánh.' });
      }

      const { rows } = await db.query(
        `UPDATE branches 
         SET name = $1, latitude = $2, longitude = $3, allowed_radius_meters = $4, 
             rate_ta_ielts = $5, rate_ta_kids = $6, rate_ta_independent = $7, rate_ta_support = $8,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $9 RETURNING *`,
        [name, latitude, longitude, allowed_radius_meters, rate_ta_ielts, rate_ta_kids, rate_ta_independent, rate_ta_support, id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'BranchNotFound', message: 'Không tìm thấy chi nhánh này.' });
      }

      res.json({ success: true, branch: rows[0], message: 'Cập nhật chi nhánh thành công.' });
    } catch (err) { next(err); }
  },

  async adminDeleteBranch(req, res, next) {
    try {
      const { id } = req.params;
      
      const { rowCount } = await db.query('DELETE FROM branches WHERE id = $1', [id]);
      if (rowCount === 0) {
        return res.status(404).json({ error: 'BranchNotFound', message: 'Không tìm thấy chi nhánh này.' });
      }

      res.json({ success: true, message: 'Xóa chi nhánh thành công.' });
    } catch (err) { next(err); }
  }
};

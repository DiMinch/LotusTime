const { verifyAccessToken } = require('../utils/auth');
const redisClient = require('../db/redis');

// Helper to parse cookies manually from headers without extra dependencies
function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.split('=').map(c => c.trim());
    if (key) acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
  return cookies[name] || null;
}

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Yêu cầu mã xác thực.' });
  }

  try {
    // 1. Verify JWT signature & expiration
    const payload = verifyAccessToken(token);

    // 2. Check if token is blacklisted in Redis
    const tokenSignature = token.split('.')[2];
    const isBlacklisted = await redisClient.get(`bl:${tokenSignature}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'TokenRevoked', message: 'Phiên làm việc đã bị thu hồi. Vui lòng đăng nhập lại.' });
    }

    // 3. Single Device Lock Check (only for non-admins)
    if (payload.role !== 'admin') {
      const clientDeviceId = req.headers['x-device-id'];
      const clientDeviceFingerprint = req.headers['x-device-fingerprint'];
      
      const activeDeviceInfoStr = await redisClient.get(`active_device:${payload.id}`);
      if (activeDeviceInfoStr) {
        const { device_id, device_fingerprint } = JSON.parse(activeDeviceInfoStr);
        if (device_id !== clientDeviceId || device_fingerprint !== clientDeviceFingerprint) {
          return res.status(401).json({ 
            error: 'DeviceSessionInvalid', 
            message: 'Tài khoản đã được đăng nhập từ thiết bị khác hoặc phiên hoạt động không hợp lệ.' 
          });
        }
      }
    }

    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'TokenExpired', message: 'Mã xác thực đã hết hạn.' });
    }
    return res.status(403).json({ error: 'InvalidToken', message: 'Mã xác thực không hợp lệ.' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Yêu cầu đăng nhập.' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden', message: 'Bạn không có quyền thực hiện chức năng này.' });
    }
    next();
  };
}

module.exports = {
  getCookie,
  authenticateToken,
  requireRole
};

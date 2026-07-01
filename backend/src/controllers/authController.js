const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/user');
const redisClient = require('../db/redis');
const { getCookie } = require('../middlewares/authMiddleware');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} = require('../utils/auth');
const { sendResetPasswordEmail } = require('../services/emailService');

// Initialize Google OAuth2 Client if client ID is configured
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
let googleClient;
if (GOOGLE_CLIENT_ID) {
  googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
}

async function verifyGoogleToken(idToken) {
  if (!googleClient) {
    throw new Error('GOOGLE_CLIENT_ID is not configured in .env');
  }
  const ticket = await googleClient.verifyIdToken({
    idToken: idToken,
    audience: GOOGLE_CLIENT_ID
  });
  return ticket.getPayload();
}

module.exports = {
  async config(req, res, next) {
    try {
      res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null });
    } catch (err) { next(err); }
  },

  async login(req, res, next) {
    try {
      const { username, password, rememberMe } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'MissingFields', message: 'Vui lòng điền tên đăng nhập/email và mật khẩu.' });
      }

      // Find user by username or email
      let user = await User.findByUsername(username);
      if (!user) {
        user = await User.findByEmail(username);
      }

      if (!user || !user.is_active) {
        return res.status(401).json({ error: 'InvalidCredentials', message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
      }

      // Verify password
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'InvalidCredentials', message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
      }

      // Generate Access Token
      const accessToken = generateAccessToken(user);

      // Generate Refresh Token with a unique Token ID (for rotation & revocation)
      const tokenId = crypto.randomUUID();
      const refreshToken = generateRefreshToken(user, tokenId);

      // Save Refresh Token state in Redis
      const refreshTTL = 7 * 24 * 60 * 60; // 7 days in seconds
      await redisClient.set(`rt:${user.id}:${tokenId}`, '1', { EX: refreshTTL });

      // Single Device Lock (except admin)
      if (user.role !== 'admin') {
        const deviceId = req.body.deviceId || req.headers['x-device-id'];
        const deviceFingerprint = req.body.deviceFingerprint || req.headers['x-device-fingerprint'];
        if (deviceId && deviceFingerprint) {
          await redisClient.set(`active_device:${user.id}`, JSON.stringify({
            device_id: deviceId,
            device_fingerprint: deviceFingerprint
          }));
        }
      }

      // Set cookie options
      const cookieMaxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : undefined; // 7 days in ms
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: cookieMaxAge
      });

      res.json({
        accessToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          person_id: user.person_id,
          person_short_name: user.person_short_name,
          person_full_name: user.person_full_name,
          is_first_login: user.is_first_login
        }
      });
    } catch (err) { next(err); }
  },

  async refresh(req, res, next) {
    try {
      const refreshToken = getCookie(req, 'refreshToken');
      if (!refreshToken) {
        return res.status(401).json({ error: 'MissingRefreshToken', message: 'Yêu cầu mã phiên làm việc.' });
      }

      let payload;
      try {
        payload = verifyRefreshToken(refreshToken);
      } catch (err) {
        return res.status(401).json({ error: 'InvalidRefreshToken', message: 'Mã phiên làm việc không hợp lệ hoặc đã hết hạn.' });
      }

      const userId = payload.id;
      const tokenId = payload.tokenId;

      // Check if Refresh Token exists in Redis
      const isActive = await redisClient.get(`rt:${userId}:${tokenId}`);
      if (!isActive) {
        // REPLAY ATTACK DETECTED!
        // Revoke all active sessions for this user for security
        const keys = await redisClient.keys(`rt:${userId}:*`);
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
        res.clearCookie('refreshToken');
        return res.status(403).json({
          error: 'TokenReuseDetected',
          message: 'Cảnh báo bảo mật: Phát hiện mã phiên làm việc đã được sử dụng trước đó. Tất cả các thiết bị đã bị đăng xuất.'
        });
      }

      // Rotate: Delete old token from Redis
      await redisClient.del(`rt:${userId}:${tokenId}`);

      // Load user details
      const user = await User.findById(userId);
      if (!user || !user.is_active) {
        res.clearCookie('refreshToken');
        return res.status(401).json({ error: 'UserInactive', message: 'Tài khoản đã bị khóa hoặc không tồn tại.' });
      }

      // Single Device Lock check during refresh (except admin)
      if (user.role !== 'admin') {
        const clientDeviceId = req.headers['x-device-id'];
        const clientDeviceFingerprint = req.headers['x-device-fingerprint'];
        const activeDeviceInfoStr = await redisClient.get(`active_device:${user.id}`);
        if (activeDeviceInfoStr) {
          const { device_id, device_fingerprint } = JSON.parse(activeDeviceInfoStr);
          if (device_id !== clientDeviceId || device_fingerprint !== clientDeviceFingerprint) {
            res.clearCookie('refreshToken');
            return res.status(401).json({ 
              error: 'DeviceSessionInvalid', 
              message: 'Phiên đăng nhập không hợp lệ hoặc tài khoản đã đăng nhập ở thiết bị khác.' 
            });
          }
        }
      }

      // Generate new tokens
      const newAccessToken = generateAccessToken(user);
      const newTokenId = crypto.randomUUID();
      const newRefreshToken = generateRefreshToken(user, newTokenId);

      // Save new token in Redis
      const refreshTTL = 7 * 24 * 60 * 60;
      await redisClient.set(`rt:${user.id}:${newTokenId}`, '1', { EX: refreshTTL });

      // Update cookie
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // Keep maximum remaining limit
      });

      res.json({
        accessToken: newAccessToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          person_id: user.person_id,
          person_short_name: user.person_short_name,
          person_full_name: user.person_full_name,
          is_first_login: user.is_first_login
        }
      });
    } catch (err) { next(err); }
  },

  async logout(req, res, next) {
    try {
      // 1. Blacklist Access Token
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (token) {
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.decode(token);
          if (decoded && decoded.exp) {
            const remainingTTLSeconds = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
            if (remainingTTLSeconds > 0) {
              const tokenSignature = token.split('.')[2];
              await redisClient.set(`bl:${tokenSignature}`, '1', { EX: remainingTTLSeconds });
            }
          }
        } catch (err) {
          console.error('Error blacklisting access token on logout', err);
        }
      }

      // 2. Invalidate Refresh Token
      const refreshToken = getCookie(req, 'refreshToken');
      if (refreshToken) {
        try {
          const payload = verifyRefreshToken(refreshToken);
          await redisClient.del(`rt:${payload.id}:${payload.tokenId}`);
        } catch (_) {}
      }

      res.clearCookie('refreshToken');
      res.json({ success: true, message: 'Đăng xuất thành công.' });
    } catch (err) { next(err); }
  },

  async googleLogin(req, res, next) {
    try {
      const { credential } = req.body;
      if (!credential) {
        return res.status(400).json({ error: 'MissingToken', message: 'Yêu cầu ID Token từ Google.' });
      }

      if (!GOOGLE_CLIENT_ID) {
        return res.status(400).json({ error: 'GoogleNotConfigured', message: 'Chức năng đăng nhập Google chưa được cấu hình ở máy chủ. Vui lòng liên hệ Admin.' });
      }

      let googlePayload;
      try {
        googlePayload = await verifyGoogleToken(credential);
      } catch (err) {
        return res.status(400).json({ error: 'InvalidGoogleToken', message: 'Mã xác thực Google không hợp lệ hoặc đã hết hạn.' });
      }

      const googleId = googlePayload.sub;

      // Find user by google_id
      const user = await User.findAll();
      const matchedUser = user.find(u => u.google_id === googleId);

      if (!matchedUser) {
        return res.status(401).json({
          error: 'GoogleAccountNotLinked',
          message: 'Tài khoản Google này chưa được liên kết với LotusTime. Vui lòng đăng nhập bằng mật khẩu trước để thực hiện liên kết.'
        });
      }

      if (!matchedUser.is_active) {
        return res.status(401).json({ error: 'UserInactive', message: 'Tài khoản đã bị khóa.' });
      }

      // Generate new session tokens
      const accessToken = generateAccessToken(matchedUser);
      const tokenId = crypto.randomUUID();
      const refreshToken = generateRefreshToken(matchedUser, tokenId);

      // Save session in Redis
      await redisClient.set(`rt:${matchedUser.id}:${tokenId}`, '1', { EX: 7 * 24 * 60 * 60 });

      // Single Device Lock (except admin)
      if (matchedUser.role !== 'admin') {
        const deviceId = req.body.deviceId || req.headers['x-device-id'];
        const deviceFingerprint = req.body.deviceFingerprint || req.headers['x-device-fingerprint'];
        if (deviceId && deviceFingerprint) {
          await redisClient.set(`active_device:${matchedUser.id}`, JSON.stringify({
            device_id: deviceId,
            device_fingerprint: deviceFingerprint
          }));
        }
      }

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        accessToken,
        user: {
          id: matchedUser.id,
          username: matchedUser.username,
          email: matchedUser.email,
          role: matchedUser.role,
          person_id: matchedUser.person_id,
          person_short_name: matchedUser.person_short_name,
          person_full_name: matchedUser.person_full_name,
          is_first_login: matchedUser.is_first_login
        }
      });
    } catch (err) { next(err); }
  },

  async googleLink(req, res, next) {
    try {
      const { credential } = req.body;
      if (!credential) {
        return res.status(400).json({ error: 'MissingToken', message: 'Yêu cầu ID Token từ Google.' });
      }

      if (!GOOGLE_CLIENT_ID) {
        return res.status(400).json({ error: 'GoogleNotConfigured', message: 'Chức năng đăng nhập Google chưa được cấu hình.' });
      }

      let googlePayload;
      try {
        googlePayload = await verifyGoogleToken(credential);
      } catch (err) {
        return res.status(400).json({ error: 'InvalidGoogleToken', message: 'Mã xác thực Google không hợp lệ.' });
      }

      const googleId = googlePayload.sub;
      const googleEmail = googlePayload.email;

      // 1. Ensure user's email matches Google account's email
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'UserNotFound', message: 'Không tìm thấy tài khoản.' });
      }

      if (user.email.toLowerCase() !== googleEmail.toLowerCase()) {
        return res.status(400).json({
          error: 'EmailMismatch',
          message: `Email tài khoản Google (${googleEmail}) không trùng khớp với email của tài khoản LotusTime (${user.email}).`
        });
      }

      // 2. Ensure Google ID is not already linked to another account
      const allUsers = await User.findAll();
      const alreadyLinked = allUsers.find(u => u.google_id === googleId && u.id !== user.id);
      if (alreadyLinked) {
        return res.status(400).json({
          error: 'GoogleIdAlreadyLinked',
          message: 'Tài khoản Google này đã được liên kết với một tài khoản LotusTime khác.'
        });
      }

      // 3. Update google_id
      await User.update(user.id, { google_id: googleId });
      res.json({ success: true, message: 'Liên kết tài khoản Google thành công!' });
    } catch (err) { next(err); }
  },

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'MissingEmail', message: 'Vui lòng cung cấp địa chỉ email.' });
      }

      const user = await User.findByEmail(email);
      if (!user || !user.is_active) {
        // Return success for security to prevent email enumerations
        return res.json({ success: true, message: 'Đường dẫn đặt lại mật khẩu đã được gửi đến email của bạn nếu địa chỉ này tồn tại.' });
      }

      // Generate a secure 32-byte reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Hash reset token via SHA256 before saving to DB
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins TTL

      await User.updateResetToken(user.id, { hash: resetTokenHash, expires: resetTokenExpires });

      // Send email containing the plain-text token
      await sendResetPasswordEmail(user.email, user.username, resetToken);

      res.json({ success: true, message: 'Đường dẫn đặt lại mật khẩu đã được gửi đến email của bạn.' });
    } catch (err) { next(err); }
  },

  async resetPassword(req, res, next) {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ error: 'MissingFields', message: 'Vui lòng cung cấp đầy đủ thông tin.' });
      }

      // Hash the plain token using SHA256 to match the database stored token
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findByResetTokenHash(tokenHash);
      if (!user) {
        return res.status(400).json({ error: 'InvalidToken', message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
      }

      // Hash and update the new password, then clear reset token fields
      const passwordHash = await bcrypt.hash(password, 10);
      await User.updatePassword(user.id, passwordHash);

      res.json({ success: true, message: 'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại.' });
    } catch (err) { next(err); }
  }
};

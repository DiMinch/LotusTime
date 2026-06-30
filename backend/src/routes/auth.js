const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const rateLimit = require('express-rate-limit');

// Rate limiter: 5 attempts per 15 minutes per IP + Username/Email combo
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.ip}_${req.body.username || req.body.email || ''}`,
  validate: false,
  message: {
    error: 'RateLimitExceeded',
    message: 'Bạn đã thử thao tác quá nhiều lần. Vui lòng thử lại sau 15 phút.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.get('/config', authController.config);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/google/login', authController.googleLogin);
router.post('/google/link', authenticateToken, authController.googleLink);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;

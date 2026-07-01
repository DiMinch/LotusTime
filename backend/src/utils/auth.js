const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'lotustime_jwt_secret_key_2026_secure');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'lotustime_jwt_refresh_secret_key_2026_secure');

if (process.env.NODE_ENV === 'production' && (!JWT_SECRET || !JWT_REFRESH_SECRET)) {
  throw new Error('FATAL: Insecure fallback JWT keys are not allowed in production!');
}

function generateAccessToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      role: user.role,
      person_id: user.person_id 
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function generateRefreshToken(user, tokenId) {
  return jwt.sign(
    { 
      id: user.id, 
      tokenId: tokenId 
    },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};

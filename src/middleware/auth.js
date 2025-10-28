const jwt = require('jsonwebtoken');
const Session = require('../models/Session');
const User = require('../models/User');
const dayjs = require('dayjs');

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRES || '15m' });
}
function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRES || '30d' });
}

async function sessionFromCookie(req) {
  const sid = req.cookies?.sid;
  if (!sid) return null;
  const sess = await Session.findOne({ sid });
  if (!sess) return null;
  const ttlDays = Number(process.env.SESSION_TTL_DAYS || 30);
  if (dayjs(sess.updatedAt).add(ttlDays, 'day').isBefore(dayjs())) {
    await Session.deleteOne({ _id: sess._id });
    return null;
  }
  const user = await User.findById(sess.user);
  if (!user) return null;
  req.session = sess;
  return { sub: user._id.toString(), role: user.role, name: user.name };
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      req.user = decoded;
      return next();
    } catch (e) {
      // fallthrough to cookie session
    }
  }
  try {
    const sessUser = await sessionFromCookie(req);
    if (sessUser) { req.user = sessUser; return next(); }
    return res.status(401).json({ error: 'Unauthorized' });
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

module.exports = { signAccessToken, signRefreshToken, requireAuth, requireAdmin };

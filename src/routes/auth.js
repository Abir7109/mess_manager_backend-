const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const { signAccessToken, signRefreshToken } = require('../middleware/auth');

function setRefreshCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  const domain = process.env.COOKIE_DOMAIN; // if not set, omit to default to current domain
  const options = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: 1000 * 60 * 60 * 24 * 30
  };
  if (domain) options.domain = domain;
  res.cookie('refresh_token', token, options);
}

function setSessionCookie(res, sid) {
  const isProd = process.env.NODE_ENV === 'production';
  const domain = process.env.COOKIE_DOMAIN;
  const options = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * Number(process.env.SESSION_TTL_DAYS || 30)
  };
  if (domain) options.domain = domain;
  res.cookie('sid', sid, options);
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already in use' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });
    res.status(201).json({ id: user._id, name: user.name, email: user.email });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // Create DB session
    const sid = crypto.randomBytes(24).toString('hex');
    await Session.create({ sid, user: user._id, userAgent: req.headers['user-agent'] || '', ip: req.ip });
    setSessionCookie(res, sid);

    // Also provide accessToken for API calls that prefer headers (optional; frontend may ignore)
    const payload = { sub: user._id.toString(), role: user.role, name: user.name };
    const accessToken = signAccessToken(payload);

    res.json({ accessToken, user: { id: user._id, name: user.name, email: user.email, role: user.role, balance: user.balance, photoUrl: user.photoUrl, phone: user.phone } });
  } catch (e) { next(e); }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies.refresh_token;
    if (!token) return res.status(401).json({ error: 'No refresh token' });
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const payload = { sub: decoded.sub, role: decoded.role, name: decoded.name };
    const accessToken = signAccessToken(payload);
    res.json({ accessToken });
  } catch (e) { next(e); }
});

router.post('/logout', async (req, res) => {
  try {
    const sid = req.cookies?.sid;
    if (sid) { await Session.deleteOne({ sid }); }
  } catch {}
  res.clearCookie('sid', { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/auth' });
  res.json({ ok: true });
});

module.exports = router;

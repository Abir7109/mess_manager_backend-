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

function normalizeAnswer(type, answer) {
  if (!answer) return '';
  if (type === 'phone') return String(answer).replace(/\D+/g, '');
  if (type === 'color') return String(answer).trim().toLowerCase();
  return String(answer).trim();
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, recoveryType, recoveryAnswer } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    if (recoveryType && !['phone', 'color'].includes(recoveryType)) return res.status(400).json({ error: 'Invalid recoveryType' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already in use' });
    const passwordHash = await bcrypt.hash(password, 10);
    let recoveryAnswerHash = undefined;
    if (recoveryType && recoveryAnswer) {
      const norm = normalizeAnswer(recoveryType, recoveryAnswer);
      recoveryAnswerHash = await bcrypt.hash(norm, 10);
    }
    const user = await User.create({ name, email, passwordHash, recoveryType: recoveryType || undefined, recoveryAnswerHash });
    res.status(201).json({ id: user._id, name: user.name, email: user.email });
  } catch (e) { next(e); }
});

// Get recovery question type for an email (no leakage beyond type)
router.post('/recovery-question', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const user = await User.findOne({ email });
    if (!user || !user.recoveryType) return res.status(404).json({ error: 'not found' });
    const map = { phone: 'What is your personal number?', color: 'What is your favourite color?' }
    res.json({ type: user.recoveryType, prompt: map[user.recoveryType] });
  } catch (e) { next(e); }
});

// Reset password using recovery answer (no email OTP)
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, answer, newPassword } = req.body;
    if (!email || !answer || !newPassword) return res.status(400).json({ error: 'email, answer, newPassword required' });
    const user = await User.findOne({ email });
    if (!user || !user.recoveryType || !user.recoveryAnswerHash) return res.status(400).json({ error: 'Recovery not set for this account' });
    const norm = normalizeAnswer(user.recoveryType, answer);
    const ok = await bcrypt.compare(norm, user.recoveryAnswerHash);
    if (!ok) return res.status(403).json({ error: 'Verification failed' });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // Create DB session (optional cookie-based auth)
    const sid = crypto.randomBytes(24).toString('hex');
    await Session.create({ sid, user: user._id, userAgent: req.headers['user-agent'] || '', ip: req.ip });
    setSessionCookie(res, sid);

    // Header token auth
    const payload = { sub: user._id.toString(), role: user.role, name: user.name };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.json({ accessToken, refreshToken, user: { id: user._id, name: user.name, email: user.email, role: user.role, balance: user.balance, photoUrl: user.photoUrl, phone: user.phone } });
  } catch (e) { next(e); }
});

router.post('/refresh', async (req, res, next) => {
  try {
    let token = null;
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) token = auth.slice(7);
    if (!token) token = req.body?.refreshToken;
    if (!token) token = req.cookies?.refresh_token;
    if (!token) return res.status(401).json({ error: 'No refresh token' });
    try {
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      const payload = { sub: decoded.sub, role: decoded.role, name: decoded.name };
      const accessToken = signAccessToken(payload);
      return res.json({ accessToken });
    } catch (err) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
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

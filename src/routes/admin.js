const router = require('express').Router();
const dayjs = require('dayjs');
const User = require('../models/User');
const MealLog = require('../models/MealLog');
const Setting = require('../models/Setting');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { computeDailyCount } = require('../utils/mealCount');
const { generateOverviewPDF } = require('../utils/pdf');

// Ensure settings doc exists
async function getSettings() {
  let s = await Setting.findOne();
  if (!s) s = await Setting.create({});
  return s;
}

function getMonthDates(month) {
  const start = dayjs(month + '-01');
  const end = start.endOf('month');
  const dates = [];
  for (let d = start; d.isBefore(end) || d.isSame(end, 'day'); d = d.add(1, 'day')) {
    dates.push(d.format('YYYY-MM-DD'));
  }
  return dates;
}

// Admin: list users
router.get('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const users = await User.find().select('-passwordHash');
    res.json(users);
  } catch (e) { next(e); }
});

// Admin: create user
router.post('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, email, password, role, balance, phone, photoUrl } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already used' });
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role: role || 'user', balance: balance || 0, phone, photoUrl });
    res.status(201).json({ id: user._id });
  } catch (e) { next(e); }
});

// Admin: update user
router.patch('/users/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, email, role, balance, phone, photoUrl, password } = req.body;
    const update = { name, email, role, balance, phone, photoUrl };
    if (password) {
      const bcrypt = require('bcryptjs');
      update.passwordHash = await bcrypt.hash(password, 10);
    }
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-passwordHash');
    res.json(user);
  } catch (e) { next(e); }
});

// Admin: delete user
router.delete('/users/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    await MealLog.deleteMany({ user: req.params.id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Admin: upsert meal log for any user
router.post('/meals/upsert', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { userId, date, breakfast, dinner, note } = req.body;
    if (!userId || !date) return res.status(400).json({ error: 'userId and date required' });
    const updated = await MealLog.findOneAndUpdate(
      { user: userId, date },
      { $set: { breakfast: !!breakfast, dinner: !!dinner, note } },
      { upsert: true, new: true }
    );
    res.json(updated);
  } catch (e) { next(e); }
});

// Admin: settings get/update
router.get('/settings', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const s = await getSettings();
    res.json(s);
  } catch (e) { next(e); }
});

router.patch('/settings', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const s = await getSettings();
    const prevMealCost = s.mealCost;
    const fields = ['mealCost', 'countingRule', 'brandName'];
    fields.forEach(f => { if (req.body[f] !== undefined) s[f] = req.body[f]; });
    await s.save();

    // record meal price change history if value changed
    if (req.body.mealCost !== undefined && Number(prevMealCost) !== Number(req.body.mealCost)) {
      try {
        const PriceChange = require('../models/PriceChange');
        await PriceChange.create({ value: Number(s.mealCost) || 0, effectiveFrom: new Date(), createdBy: req.user.sub });
      } catch (e) { /* ignore history write errors */ }
    }

    res.json(s);
  } catch (e) { next(e); }
});

// Admin: monthly overview data
router.get('/overview', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const month = req.query.month || dayjs().format('YYYY-MM');
    const dates = getMonthDates(month);
const settings = await getSettings();
    const users = await User.find();
    const logs = await MealLog.find({ date: { $in: dates } });

    const byUser = new Map();
    users.forEach(u => byUser.set(u._id.toString(), { id: u._id.toString(), name: u.name, email: u.email, balance: u.balance, totalMeals: 0 }));

    for (const log of logs) {
      const key = log.user.toString();
      const item = byUser.get(key);
      if (!item) continue;
item.totalMeals += computeDailyCount(log, settings.countingRule || 'perMealHalf');
    }

    const result = Array.from(byUser.values()).map(u => ({
      ...u,
      mealCost: settings.mealCost,
      totalCost: (u.totalMeals || 0) * (settings.mealCost || 0),
    }));

    res.json({ month, settings, users: result });
  } catch (e) { next(e); }
});

// Admin: list meal logs for a user and month
router.get('/meals', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { userId, month } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const m = month || dayjs().format('YYYY-MM');
    const dates = getMonthDates(m);
    const logs = await MealLog.find({ user: userId, date: { $in: dates } });
    res.json({ month: m, logs });
  } catch (e) { next(e); }
});

// Admin: PDF download
router.get('/pdf', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const month = req.query.month || dayjs().format('YYYY-MM');
    const dates = getMonthDates(month);
    const settings = await getSettings();
    const users = await User.find();
    const logs = await MealLog.find({ date: { $in: dates } });

    const map = new Map();
    users.forEach(u => map.set(u._id.toString(), { name: u.name, balance: u.balance, totalMeals: 0 }));
    for (const log of logs) {
      const it = map.get(log.user.toString());
      if (!it) continue;
      it.totalMeals += computeDailyCount(log, settings.countingRule);
    }
    const payload = users.map(u => ({
      name: u.name,
      balance: u.balance,
      totalMeals: map.get(u._id.toString())?.totalMeals || 0,
      totalCost: (map.get(u._id.toString())?.totalMeals || 0) * (settings.mealCost || 0)
    }));

    generateOverviewPDF({ month, users: payload, settings }, res);
  } catch (e) { next(e); }
});

const multer = require('multer');
const { GridFSBucket, ObjectId } = require('mongodb');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// Admin upload user photo
router.post('/users/:id/photo', requireAuth, requireAdmin, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'photo file required' });
    const bucket = new GridFSBucket(req.app.locals.db);
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ error: 'user not found' });
    if (u.photoFileId) { try { await bucket.delete(new ObjectId(u.photoFileId)); } catch {} }
    const uploadStream = bucket.openUploadStream(`avatar_${u._id}_${Date.now()}`, { contentType: req.file.mimetype });
    uploadStream.end(req.file.buffer);
    uploadStream.on('error', err => next(err));
    uploadStream.on('finish', async () => {
      const id = uploadStream.id;
      const photoUrl = `/api/files/${id.toString()}`;
      await User.findByIdAndUpdate(u._id, { photoUrl, photoFileId: id });
      res.json({ photoUrl });
    });
  } catch (e) { next(e); }
});

module.exports = router;

const router = require('express').Router();
const dayjs = require('dayjs');
const User = require('../models/User');
const MealLog = require('../models/MealLog');
const Setting = require('../models/Setting');
const { computeDailyCount } = require('../utils/mealCount');

function getDates(month) {
  const start = dayjs(month + '-01');
  const end = start.endOf('month');
  const dates = [];
  for (let d = start; d.isBefore(end) || d.isSame(end, 'day'); d = d.add(1, 'day')) dates.push(d.format('YYYY-MM-DD'));
  return dates;
}

router.get('/users', async (req, res, next) => {
  try {
    const month = req.query.month || dayjs().format('YYYY-MM');
    const dates = getDates(month);
    const [settings] = await Setting.find().limit(1);
    const rule = settings?.countingRule || 'perMealHalf';
    const cost = settings?.mealCost || 0;
    const users = await User.find();
    const logs = await MealLog.find({ date: { $in: dates } });
    const map = new Map();
    users.forEach(u => map.set(u._id.toString(), { id: u._id.toString(), name: u.name, email: u.email, phone: u.phone, photoUrl: u.photoUrl, balance: u.balance, totalMeals: 0 }));
    for (const l of logs) {
      const it = map.get(l.user.toString());
      if (it) it.totalMeals += computeDailyCount(l, rule);
    }
    const list = Array.from(map.values()).map(u => ({ ...u, totalCost: u.totalMeals * cost }));
    res.json({ month, users: list, mealCost: cost });
  } catch (e) { next(e); }
});

router.get('/users/:id', async (req, res, next) => {
  try {
    const month = req.query.month || dayjs().format('YYYY-MM');
    const dates = getDates(month);
    const [settings] = await Setting.find().limit(1);
    const rule = settings?.countingRule || 'perMealHalf';
    const cost = settings?.mealCost || 0;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'not found' });
    const logs = await MealLog.find({ user: user._id, date: { $in: dates } });
    const totalMeals = logs.reduce((s, l) => s + computeDailyCount(l, rule), 0);
    const totalCost = totalMeals * cost;
    res.json({ month, user: { id: user._id, name: user.name, email: user.email, phone: user.phone, photoUrl: user.photoUrl, balance: user.balance }, totalMeals, totalCost, mealCost: cost, logs });
  } catch (e) { next(e); }
});

// Meal price history for a month (step function by change dates)
router.get('/meal-price-history', async (req, res, next) => {
  try {
    const month = req.query.month || dayjs().format('YYYY-MM');
    const start = dayjs(month + '-01');
    const end = start.endOf('month');
    const startDate = start.toDate();
    const endDate = end.toDate();

    const Setting = require('../models/Setting');
    const PriceChange = require('../models/PriceChange');

    const [settings] = await Setting.find().limit(1);
    const current = Number(settings?.mealCost || 0);

    const before = await PriceChange.findOne({ effectiveFrom: { $lt: startDate } }).sort({ effectiveFrom: -1 });
    const changes = await PriceChange.find({ effectiveFrom: { $gte: startDate, $lte: endDate } }).sort({ effectiveFrom: 1 });

    // precompute change days as YYYY-MM-DD in UTC without relying on dayjs utc plugin
    function toUTCDateString(dt) {
      const d = new Date(dt);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    }
    const changeDays = changes.map(c => ({ day: toUTCDateString(c.effectiveFrom), value: Number(c.value) || 0 }));

    // build per-day values (carry-forward last known) using the provided month string
    const labels = [];
    const values = [];
    let pointer = 0;
    let active = before ? Number(before.value) : current;
    const daysInMonth = end.date();
    for (let i = 1; i <= daysInMonth; i++) {
      const curDay = `${month}-${String(i).padStart(2, '0')}`;
      while (pointer < changeDays.length && changeDays[pointer].day <= curDay) {
        active = changeDays[pointer].value;
        pointer++;
      }
      labels.push(String(i));
      values.push(active);
    }

    res.json({ month, labels, values });
  } catch (e) { next(e); }
});

module.exports = router;

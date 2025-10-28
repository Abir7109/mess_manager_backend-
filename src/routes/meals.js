const router = require('express').Router();
const dayjs = require('dayjs');
const MealLog = require('../models/MealLog');
const Setting = require('../models/Setting');
const { requireAuth } = require('../middleware/auth');
const { computeDailyCount } = require('../utils/mealCount');

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const month = req.query.month || dayjs().format('YYYY-MM');
    const start = dayjs(month + '-01');
    const end = start.endOf('month');
    const dates = [];
    for (let d = start; d.isBefore(end) || d.isSame(end, 'day'); d = d.add(1, 'day')) {
      dates.push(d.format('YYYY-MM-DD'));
    }
    const logs = await MealLog.find({ user: req.user.sub, date: { $in: dates } });
    res.json(logs);
  } catch (e) { next(e); }
});

router.post('/mine', requireAuth, async (req, res, next) => {
  try {
    return res.status(403).json({ error: 'Users cannot modify meals. Please contact an admin.' });
  } catch (e) { next(e); }
});

router.get('/summary/mine', requireAuth, async (req, res, next) => {
  try {
    const month = req.query.month || dayjs().format('YYYY-MM');
    const start = dayjs(month + '-01');
    const end = start.endOf('month');
    const dates = [];
    for (let d = start; d.isBefore(end) || d.isSame(end, 'day'); d = d.add(1, 'day')) {
      dates.push(d.format('YYYY-MM-DD'));
    }
    const [settings] = await Setting.find().limit(1);
    const countingRule = settings?.countingRule || 'bothEqualsOne';
    const mealCost = settings?.mealCost || 0;

    const logs = await MealLog.find({ user: req.user.sub, date: { $in: dates } });
    const totalMeals = logs.reduce((sum, l) => sum + computeDailyCount(l, countingRule), 0);
    const totalCost = totalMeals * mealCost;
    res.json({ month, totalMeals, mealCost, totalCost });
  } catch (e) { next(e); }
});

module.exports = router;

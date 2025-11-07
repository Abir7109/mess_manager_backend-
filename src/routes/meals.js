const router = require('express').Router();
const dayjs = require('dayjs');
const mongoose = require('mongoose');
const MealLog = require('../models/MealLog');
const Setting = require('../models/Setting');
const Expense = require('../models/Expense');
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
    const { date, breakfast, dinner, breakfastQuarters, dinnerQuarters } = req.body;
    if (!date) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' });
    const existing = await MealLog.findOne({ user: req.user.sub, date });

    const prevB = !!existing?.breakfast;
    const prevD = !!existing?.dinner;
    const prevBQ = Number.isFinite(existing?.breakfastQuarters) ? existing.breakfastQuarters : 0;
    const prevDQ = Number.isFinite(existing?.dinnerQuarters) ? existing.dinnerQuarters : 0;

    // Clamp quarters 0..2 and only allow increment (no decrement by users)
    const clamp = v => Math.max(0, Math.min(2, Math.floor(Number(v))))
    const reqBQ = Number.isFinite(Number(breakfastQuarters)) ? clamp(breakfastQuarters) : prevBQ;
    const reqDQ = Number.isFinite(Number(dinnerQuarters)) ? clamp(dinnerQuarters) : prevDQ;
    const nextBQ = Math.max(prevBQ, reqBQ)
    const nextDQ = Math.max(prevDQ, reqDQ)

    const nextB = (breakfast === true) || prevB || nextBQ >= 2;
    const nextD = (dinner === true) || prevD || nextDQ >= 2;

    // deny attempts to disable legacy booleans
    if ((breakfast === false && prevB) || (dinner === false && prevD)) {
      return res.status(403).json({ error: 'Users cannot deselect meals. Contact an admin.' });
    }
    const updated = await MealLog.findOneAndUpdate(
      { user: req.user.sub, date },
      { $set: { breakfast: nextB, dinner: nextD, breakfastQuarters: nextBQ, dinnerQuarters: nextDQ } },
      { upsert: true, new: true }
    );
    res.json(updated);
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
    const countingRule = settings?.countingRule || 'perMealHalf';
    const mealCost = settings?.mealCost || 0;

    const logs = await MealLog.find({ user: req.user.sub, date: { $in: dates } });
    const totalMeals = logs.reduce((sum, l) => sum + computeDailyCount(l, countingRule), 0);
    const mealsCost = totalMeals * mealCost;

    // shared expenses share this month
    const expStart = start.toDate();
    const expEnd = end.toDate();
    const shared = await Expense.find({
      shared: true,
      date: { $gte: expStart, $lte: expEnd },
      participants: new mongoose.Types.ObjectId(req.user.sub)
    });
    const sharedShare = shared.reduce((s, e) => s + (e.amount / Math.max(1, (e.participants?.length || 1))), 0);

    const totalCost = mealsCost + sharedShare;
    res.json({ month, totalMeals, mealCost, mealsCost, sharedShare, totalCost });
  } catch (e) { next(e); }
});

module.exports = router;

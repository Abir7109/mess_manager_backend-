const router = require('express').Router();
const dayjs = require('dayjs');
const { requireAuth } = require('../middleware/auth');
const MealLog = require('../models/MealLog');
const User = require('../models/User');

// Compute basic notifications: low balance and skipped meals (last 7 days)
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const me = await User.findById(req.user.sub);
    const notifs = [];

    // low balance threshold
    const threshold = Number(process.env.LOW_BALANCE_THRESHOLD || 200);
    if ((me.balance || 0) < threshold) {
      notifs.push({ type: 'low_balance', message: `Your balance is low (৳${me.balance || 0}).` });
    }

    const today = dayjs();
    const seven = today.subtract(7, 'day');
    const dates = [];
    for (let d = seven; d.isBefore(today) || d.isSame(today, 'day'); d = d.add(1, 'day')) dates.push(d.format('YYYY-MM-DD'));
    const logs = await MealLog.find({ user: me._id, date: { $in: dates } });
    const set = new Set(logs.map(l => l.date));
    const skipped = dates.filter(d => !set.has(d));
    if (skipped.length > 0) notifs.push({ type: 'skipped_meals', message: `You skipped ${skipped.length} day(s) in the last 7 days.` });

    res.json(notifs);
  } catch (e) { next(e); }
});

module.exports = router;
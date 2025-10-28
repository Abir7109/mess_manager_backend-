const router = require('express').Router();
const dayjs = require('dayjs');
const { requireAuth } = require('../middleware/auth');
const Expense = require('../models/Expense');
const User = require('../models/User');

// Create expense (optionally shared)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { amount, description, category = 'other', shared = false, participants = [] } = req.body;
    if (!amount) return res.status(400).json({ error: 'amount required' });
    let parts = participants;
    if (shared && (!Array.isArray(parts) || parts.length === 0)) {
      // default: split among all users
      const all = await User.find({}, '_id');
      parts = all.map(u => u._id);
    }
    const exp = await Expense.create({ user: req.user.sub, amount, description, category, shared, participants: parts });
    res.status(201).json({ id: exp._id });
  } catch (e) { next(e); }
});

// Get my expenses for month
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const month = req.query.month || dayjs().format('YYYY-MM');
    const start = dayjs(month + '-01').toDate();
    const end = dayjs(month + '-01').endOf('month').toDate();
    const mine = await Expense.find({ user: req.user.sub, date: { $gte: start, $lte: end } }).sort({ date: -1 });
    res.json(mine);
  } catch (e) { next(e); }
});

// Get shared expenses and calculated split for month
router.get('/shared', requireAuth, async (req, res, next) => {
  try {
    const month = req.query.month || dayjs().format('YYYY-MM');
    const start = dayjs(month + '-01').toDate();
    const end = dayjs(month + '-01').endOf('month').toDate();
    const shared = await Expense.find({ shared: true, date: { $gte: start, $lte: end } }).populate('participants', 'name');
    // compute owed per user
    const owed = new Map();
    for (const e of shared) {
      const per = e.amount / (e.participants?.length || 1);
      for (const p of e.participants || []) {
        const key = p._id.toString();
        owed.set(key, (owed.get(key) || 0) + per);
      }
    }
    res.json({ shared, owed: Object.fromEntries(owed) });
  } catch (e) { next(e); }
});

module.exports = router;

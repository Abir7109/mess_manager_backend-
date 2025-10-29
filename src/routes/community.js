const router = require('express').Router();
const dayjs = require('dayjs');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const Suggestion = require('../models/Suggestion');

// List suggestions with vote counts and whether current user voted
router.get('/suggestions', requireAuth, async (req, res, next) => {
  try {
    const list = await Suggestion.find({ status: 'open' }).sort({ createdAt: -1 });
    const me = req.user.sub;
    const data = list.map(s => ({
      id: s._id,
      title: s.title,
      forDate: s.forDate,
      votes: s.votes.length,
      voted: s.votes.some(v => v.toString() === me),
      createdAt: s.createdAt,
    }));
    res.json(data);
  } catch (e) { next(e); }
});

// Create suggestion
router.post('/suggestions', requireAuth, async (req, res, next) => {
  try {
    const { title, forDate } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const s = await Suggestion.create({ title, forDate, createdBy: req.user.sub, votes: [] });
    res.status(201).json({ id: s._id });
  } catch (e) { next(e); }
});

// Toggle vote
router.post('/suggestions/:id/vote', requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id;
    const s = await Suggestion.findById(id);
    if (!s) return res.status(404).json({ error: 'not found' });
    const me = req.user.sub;
    const idx = s.votes.findIndex(v => v.toString() === me);
    if (idx >= 0) s.votes.splice(idx, 1); else s.votes.push(me);
    await s.save();
    res.json({ id: s._id, votes: s.votes.length, voted: s.votes.some(v => v.toString() === me) });
  } catch (e) { next(e); }
});

// Delete suggestion (admin only)
router.delete('/suggestions/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await Suggestion.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;

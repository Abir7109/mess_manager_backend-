const router = require('express').Router();
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const me = await User.findById(req.user.sub).select('-passwordHash');
    res.json(me);
  } catch (e) { next(e); }
});

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const { name, photoUrl, phone } = req.body;
    const updated = await User.findByIdAndUpdate(req.user.sub, { name, photoUrl, phone }, { new: true }).select('-passwordHash');
    res.json(updated);
  } catch (e) { next(e); }
});

module.exports = router;

const router = require('express').Router();
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const multer = require('multer');
const { GridFSBucket, ObjectId } = require('mongodb');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

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

// Upload profile photo (GridFS)
router.post('/me/photo', requireAuth, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'photo file required' });
    const bucket = new GridFSBucket(req.app.locals.db);
    // delete previous photo if exists
    const me = await User.findById(req.user.sub);
    if (me?.photoFileId) {
      try { await bucket.delete(new ObjectId(me.photoFileId)); } catch {}
    }
    const uploadStream = bucket.openUploadStream(`avatar_${req.user.sub}_${Date.now()}`, { contentType: req.file.mimetype });
    uploadStream.end(req.file.buffer);
    uploadStream.on('error', err => next(err));
    uploadStream.on('finish', async () => {
      const id = uploadStream.id;
      const photoUrl = `/api/files/${id.toString()}`;
      await User.findByIdAndUpdate(req.user.sub, { photoUrl, photoFileId: id });
      res.json({ photoUrl });
    });
  } catch (e) { next(e); }
});

module.exports = router;

const router = require('express').Router();
const { ObjectId } = require('mongodb');

router.get('/:id', async (req, res, next) => {
  try {
    const bucket = new (require('mongodb')).GridFSBucket(req.app.locals.db);
    const id = new ObjectId(req.params.id);
    const files = await req.app.locals.db.collection('fs.files').find({ _id: id }).toArray();
    if (!files || files.length === 0) return res.status(404).json({ error: 'not found' });
    res.setHeader('Content-Type', files[0].contentType || 'application/octet-stream');
    bucket.openDownloadStream(id).pipe(res);
  } catch (e) { next(e); }
});

module.exports = router;
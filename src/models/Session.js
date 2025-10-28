const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sid: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userAgent: { type: String },
  ip: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);

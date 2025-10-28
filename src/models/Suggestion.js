const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  forDate: { type: String }, // optional YYYY-MM-DD
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
}, { timestamps: true });

suggestionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Suggestion', suggestionSchema);

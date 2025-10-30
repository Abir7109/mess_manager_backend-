const mongoose = require('mongoose');

const priceChangeSchema = new mongoose.Schema({
  value: { type: Number, required: true },
  effectiveFrom: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

priceChangeSchema.index({ effectiveFrom: 1 });

module.exports = mongoose.model('PriceChange', priceChangeSchema);
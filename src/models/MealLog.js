const mongoose = require('mongoose');

const mealLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  breakfast: { type: Boolean, default: false },
  dinner: { type: Boolean, default: false },
  note: { type: String },
}, { timestamps: true });

mealLogSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('MealLog', mealLogSchema);

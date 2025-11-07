const mongoose = require('mongoose');

const mealLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  // Legacy booleans (each equals 0.5 when countingRule = perMealHalf)
  breakfast: { type: Boolean, default: false },
  dinner: { type: Boolean, default: false },
  // New: quarter counters per meal time (0..2) where each quarter = 0.25
  breakfastQuarters: { type: Number, min: 0, max: 2, default: 0 },
  dinnerQuarters: { type: Number, min: 0, max: 2, default: 0 },
  // Admin override: if set, this numeric value is used as the daily meal count
  overrideCount: { type: Number },
  note: { type: String },
}, { timestamps: true });

mealLogSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('MealLog', mealLogSchema);

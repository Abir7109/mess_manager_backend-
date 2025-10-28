const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  mealCost: { type: Number, default: 100 },
countingRule: { type: String, enum: ['bothEqualsOne', 'anyMealIsOne', 'perMeal', 'perMealHalf'], default: 'perMealHalf' },
  brandName: { type: String, default: 'Mess Manager' },
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);

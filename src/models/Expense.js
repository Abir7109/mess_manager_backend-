const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: { type: Number, required: true },
  description: { type: String },
  date: { type: Date, default: Date.now },
  category: { type: String, enum: ['grocery', 'gas', 'other'], default: 'other' },
  shared: { type: Boolean, default: false },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);

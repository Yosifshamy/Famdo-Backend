const mongoose = require('mongoose');

const TodoSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  text: { type: String, required: true },
  describtion: { type: String },
  deadline: { type: Date },
  done: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Todo', TodoSchema);
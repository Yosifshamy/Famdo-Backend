const mongoose = require('mongoose');

const FamilyTodoSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  text: { type: String, required: true },
  family: { type: mongoose.Schema.Types.ObjectId, ref: 'Family' }, // <-- add this!
  describtion: { type: String },
  deadline: { type: Date },
  done: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('FamilyTodo', FamilyTodoSchema);
const mongoose = require('mongoose');

const FamilySchema = new mongoose.Schema({
  name: { type: String, required: true },
  referralCode: { type: String, required: true, unique: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Family', FamilySchema);
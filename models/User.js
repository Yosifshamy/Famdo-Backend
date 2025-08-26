const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  googleId: { type: String, sparse: true }, // sparse allows multiple null values
  displayName: { type: String },
  avatar: { type: String },
  family: { type: mongoose.Schema.Types.ObjectId, ref: 'Family' }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    login: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

// tworzymy model Admin i udostępniamy unnym plikom
module.exports = mongoose.model('Admin', adminSchema);

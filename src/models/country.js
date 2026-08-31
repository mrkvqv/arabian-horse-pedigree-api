const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z]{2}$/, 'Country code must contain exactly two uppercase letters.'],
    },
    namePl: {
      type: String,
      required: true,
      trim: true,
    },
  },
  // pola createdAt i updatedAt
  { timestamps: true },
);

// tworzymy model Country i udostępniamy unnym plikom
module.exports = mongoose.model('Country', countrySchema);

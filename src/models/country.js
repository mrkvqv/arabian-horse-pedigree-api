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
  { timestamps: true },
);

module.exports = mongoose.model('Country', countrySchema);

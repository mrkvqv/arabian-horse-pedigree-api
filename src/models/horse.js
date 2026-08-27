const mongoose = require('mongoose');

const horseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    birthYear: {
      type: Number,
      required: true,
      min: 1,
      max: new Date().getFullYear(),
    },
    sex: {
      type: String,
      required: true,
      enum: ['klacz', 'ogier', 'wałach'],
    },
    coat: {
      type: String,
      required: true,
      enum: ['siwa', 'gniada', 'kasztanowata', 'kara'],
    },
    countryOfBirth: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Country',
      required: true,
    },
    mother: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Horse',
    },
    father: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Horse',
    },
    breeder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Breeder',
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Horse', horseSchema);

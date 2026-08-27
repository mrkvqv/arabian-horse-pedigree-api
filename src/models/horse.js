const mongoose = require('mongoose');
const Country = require('./country');
const Breeder = require('./breeder');

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

horseSchema.pre('validate', async function validateReferences() {
  const [countryExists, breederExists, motherExists, fatherExists] = await Promise.all([
    this.countryOfBirth ? Country.exists({ _id: this.countryOfBirth }) : true,
    this.breeder ? Breeder.exists({ _id: this.breeder }) : true,
    this.mother ? this.constructor.exists({ _id: this.mother }) : true,
    this.father ? this.constructor.exists({ _id: this.father }) : true,
  ]);

  if (!countryExists) {
    this.invalidate('countryOfBirth', 'Country of birth does not exist.');
  }

  if (!breederExists) {
    this.invalidate('breeder', 'Breeder does not exist.');
  }

  if (!motherExists) {
    this.invalidate('mother', 'Mother does not exist.');
  }

  if (!fatherExists) {
    this.invalidate('father', 'Father does not exist.');
  }
});

// A horse is uniquely identified by its name, country of birth, and birth year.
horseSchema.index({ name: 1, countryOfBirth: 1, birthYear: 1 }, { unique: true });

module.exports = mongoose.model('Horse', horseSchema);

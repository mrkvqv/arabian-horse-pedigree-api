const mongoose = require('mongoose');
const Country = require('./country');

const breederSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Country',
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

breederSchema.pre('validate', async function validateCountryReference() {
  if (!this.country) {
    return;
  }

  const countryExists = await Country.exists({ _id: this.country });

  if (!countryExists) {
    this.invalidate('country', 'Country does not exist.');
  }
});

// A breeder is uniquely identified by its name and country of activity.
breederSchema.index({ name: 1, country: 1 }, { unique: true });

module.exports = mongoose.model('Breeder', breederSchema);

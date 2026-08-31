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
  // pola createdAt i updatedAt
  { timestamps: true },
);

// sprawdzamy, czy podaliśmy country razem z breeder
breederSchema.pre('validate', async function validateCountryReference() {
  if (!this.country) {
    return;
  }

// czy podany kraj istnieje
  const countryExists = await Country.exists({ _id: this.country });

// jezeli nie istnieje - bląd (ale nie zapisuje go, a tylko dodaje do listy blędów walidacji mongoose)
  if (!countryExists) {
    this.invalidate('country', 'Country does not exist.');
  }
});

//unikalność hodowcy
breederSchema.index({ name: 1, country: 1 }, { unique: true });

// tworzymy model Breeder i udostępniamy unnym plikom
module.exports = mongoose.model('Breeder', breederSchema);

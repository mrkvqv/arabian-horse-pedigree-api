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

horseSchema.pre('validate', async function validatePedigreeRules() {
  if (this.mother && this.father && String(this.mother) === String(this.father)) {
    this.invalidate('father', 'Mother and father must be different horses.');
  }

  const [mother, father] = await Promise.all([
    this.mother ? this.constructor.findById(this.mother).select('sex birthYear') : null,
    this.father ? this.constructor.findById(this.father).select('sex birthYear') : null,
  ]);

  if (this.mother && (await hasCurrentHorseAsAncestor(this, this.mother))) {
    this.invalidate('mother', 'Mother cannot be this horse or its descendant.');
  }

  if (this.father && (await hasCurrentHorseAsAncestor(this, this.father))) {
    this.invalidate('father', 'Father cannot be this horse or its descendant.');
  }

  validateParent(this, mother, 'mother', 'klacz');
  validateParent(this, father, 'father', 'ogier');
});

function validateParent(horse, parent, fieldName, expectedSex) {
  if (!parent) {
    return;
  }

  if (parent.sex !== expectedSex) {
    horse.invalidate(fieldName, `${fieldName} must reference a ${expectedSex}.`);
  }

  const parentAgeAtBirth = horse.birthYear - parent.birthYear;

  if (parentAgeAtBirth < 3 || parentAgeAtBirth > 21) {
    horse.invalidate(fieldName, `${fieldName} must be between 3 and 21 years old at birth.`);
  }
}

async function hasCurrentHorseAsAncestor(horse, parentId) {
  const pendingIds = [parentId];
  const visitedIds = new Set();

  while (pendingIds.length > 0) {
    const currentId = pendingIds.pop();
    const currentIdString = String(currentId);

    if (currentIdString === String(horse._id)) {
      return true;
    }

    if (visitedIds.has(currentIdString)) {
      continue;
    }

    visitedIds.add(currentIdString);

    const currentHorse = await horse.constructor
      .findById(currentId)
      .select('mother father')
      .lean();

    if (currentHorse?.mother) {
      pendingIds.push(currentHorse.mother);
    }

    if (currentHorse?.father) {
      pendingIds.push(currentHorse.father);
    }
  }

  return false;
}

horseSchema.index({ name: 1, countryOfBirth: 1, birthYear: 1 }, { unique: true });

module.exports = mongoose.model('Horse', horseSchema);

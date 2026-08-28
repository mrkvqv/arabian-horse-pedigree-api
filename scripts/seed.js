require('dotenv').config({ quiet: true });

const { faker } = require('@faker-js/faker');
const mongoose = require('mongoose');

const { connectToDatabase } = require('../src/config/database');
const Country = require('../src/models/country');
const Breeder = require('../src/models/breeder');
const Horse = require('../src/models/horse');

const SEED_MARKER = '__ARABIAN_HORSE_DEMO_SEED__';
const COUNTRY_DATA = [
  { code: 'PL', namePl: 'Polska' },
  { code: 'AE', namePl: 'Zjednoczone Emiraty Arabskie' },
  { code: 'SA', namePl: 'Arabia Saudyjska' },
];
const COATS = ['siwa', 'gniada', 'kasztanowata', 'kara'];
const SEXES = ['klacz', 'ogier', 'wałach'];

async function findOrCreateCountry(data) {
  const existingCountry = await Country.findOne({ code: data.code });
  return existingCountry || Country.create(data);
}

async function removePreviousSeed() {
  const horses = await Horse.find({ notes: SEED_MARKER }).select('_id');
  const horseIds = horses.map((horse) => horse._id);

  if (horseIds.length > 0) {
    const hasExternalChildren = await Horse.exists({
      notes: { $ne: SEED_MARKER },
      $or: [{ mother: { $in: horseIds } }, { father: { $in: horseIds } }],
    });

    if (hasExternalChildren) {
      throw new Error('Cannot remove demo horses because they are parents of non-demo horses.');
    }

    await Horse.deleteMany({ notes: SEED_MARKER });
  }

  const breeders = await Breeder.find({ notes: SEED_MARKER }).select('_id');
  const breederIds = breeders.map((breeder) => breeder._id);

  if (breederIds.length > 0) {
    const hasExternalHorses = await Horse.exists({
      notes: { $ne: SEED_MARKER },
      breeder: { $in: breederIds },
    });

    if (hasExternalHorses) {
      throw new Error('Cannot remove demo breeders because they are used by non-demo horses.');
    }

    await Breeder.deleteMany({ notes: SEED_MARKER });
  }
}

async function createSeedData() {
  faker.seed(20260828);
  await connectToDatabase();

  try {
    await removePreviousSeed();

    const countries = await Promise.all(COUNTRY_DATA.map(findOrCreateCountry));
    const breeders = await Promise.all(countries.map((country) => Breeder.create({
      name: `Demo breeder ${country.code}`,
      country: country._id,
      notes: SEED_MARKER,
    })));

    let horseNumber = 1;

    async function createHorse(birthYear, generationsLeft, requiredSex) {
      let mother;
      let father;

      if (generationsLeft > 0) {
        const motherBirthYear = birthYear - faker.number.int({ min: 5, max: 15 });
        const fatherBirthYear = birthYear - faker.number.int({ min: 5, max: 15 });
        mother = await createHorse(motherBirthYear, generationsLeft - 1, 'klacz');
        father = await createHorse(fatherBirthYear, generationsLeft - 1, 'ogier');
      }

      const country = faker.helpers.arrayElement(countries);
      const breeder = faker.helpers.arrayElement(breeders);
      const name = `${faker.word.adjective()} ${faker.word.noun()} ${horseNumber}`;
      horseNumber += 1;

      return Horse.create({
        name,
        birthYear,
        sex: requiredSex || faker.helpers.arrayElement(SEXES),
        coat: faker.helpers.arrayElement(COATS),
        countryOfBirth: country._id,
        breeder: breeder._id,
        mother: mother?._id,
        father: father?._id,
        notes: SEED_MARKER,
      });
    }

    const rootHorse = await createHorse(2020, 6, 'ogier');
    const rootCountry = countries.find((country) => String(country._id) === String(rootHorse.countryOfBirth));
    console.log(`Created ${horseNumber - 1} demo horses.`);
    console.log(`Open a six-generation pedigree for: ${rootHorse.name} ${rootCountry.code} ${rootHorse.birthYear}`);
  } finally {
    await mongoose.disconnect();
  }
}

createSeedData().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

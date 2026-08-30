require('dotenv').config({ quiet: true });

const { faker } = require('@faker-js/faker');
const mongoose = require('mongoose');

const { connectToDatabase } = require('../src/config/database');
const Country = require('../src/models/country');
const Breeder = require('../src/models/breeder');
const Horse = require('../src/models/horse');

// specjalna wartość w polu notes rozróżnia dane demo od danych dodanych ręcznie
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

// rrzed utworzeniem świeżych danych demo usuwamy poprzedni seed, gdy jego usunięcie nie zerwie relacji w danych dodanych ręcznie przez uzyt
async function removePreviousSeed() {
  // pobieramy tylko _id starych koni demo, bo właśnie identyfikatory są potrzebne
  const horses = await Horse.find({ notes: SEED_MARKER }).select('_id');
  // prosta tablicę ich identyfikatorów.
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

  // tak samo pobieramy identyfikatory hodowców demo
  const breeders = await Breeder.find({ notes: SEED_MARKER }).select('_id');
  const breederIds = breeders.map((breeder) => breeder._id);

  if (breederIds.length > 0) {
   // czy nie ma ręcznie dodanych koni
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
  // faker generuje przewidywalny zestaw danych
  faker.seed(20260828);
  await connectToDatabase();

  try {
    await removePreviousSeed();

    // dla każdego kraju tworzymy dokument lub używamy istniejącego dokumentu
    const countries = await Promise.all(COUNTRY_DATA.map(findOrCreateCountry));
    // dla każdego kraju tworzymy hodowcę o tej samej nazwie; unikalność zapewnia para nazwa + kraj
    const breeders = await Promise.all(countries.map((country) => Breeder.create({
      name: 'Demo breeder',
      country: country._id,
      notes: SEED_MARKER,
    })));

    // pełne identyfikatory już utworzonych koni, zeby nie bylo dupl
    const usedHorseIdentifiers = new Set();

    // tworzymy konia i jeśli trzeba jego przodków (z rekur)
    async function createHorse(birthYear, generationsLeft, requiredSex) {
      let mother;
      let father;

      if (generationsLeft > 0) {
        const motherBirthYear = birthYear - faker.number.int({ min: 5, max: 15 });
        const fatherBirthYear = birthYear - faker.number.int({ min: 5, max: 15 });
        // тajpierw tworzymy przodków, aby ich id można było zapisać przy tworzeniu dziecka
        mother = await createHorse(motherBirthYear, generationsLeft - 1, 'klacz');
        father = await createHorse(fatherBirthYear, generationsLeft - 1, 'ogier');
      }

      // дosujemy poprawny kraj, hodowcę, maść i elementy nazwy dla bieżącego konia
      const country = faker.helpers.arrayElement(countries);
      const breeder = faker.helpers.arrayElement(breeders);
      let name;
      let identifier;

      do {
        name = faker.helpers.arrayElement([
          faker.word.noun(),
          `${faker.word.adjective()} ${faker.word.noun()}`,
        ]);
        identifier = `${name} ${country.code} ${birthYear}`;
      } while (usedHorseIdentifiers.has(identifier));

      usedHorseIdentifiers.add(identifier);

      // еworzymy konia, relacje do kraju, hodowcy i rodziców zapisujemy przez ObjectId.
      return Horse.create({
        name,
        birthYear,
        // Gdy requiredSex nie jest podane, wybieramy losową poprawną płeć.
        sex: requiredSex || faker.helpers.arrayElement(SEXES),
        coat: faker.helpers.arrayElement(COATS),
        countryOfBirth: country._id,
        breeder: breeder._id,
        mother: mother?._id,
        father: father?._id,
        notes: SEED_MARKER,
      });
    }

    // korzeń rodowodu
    const rootHorse = await createHorse(2020, 6, 'ogier');
    // kraj urodzienie korzenia
    const rootCountry = countries.find((country) => String(country._id) === String(rootHorse.countryOfBirth));
    console.log(`Created ${usedHorseIdentifiers.size} demo horses.`);
    console.log(`Open a six-generation pedigree for: ${rootHorse.name} ${rootCountry.code} ${rootHorse.birthYear}`);
  } finally {
    await mongoose.disconnect();
  }
}

// uruchamiamy seed, jeśli bląd - pokazujemy komunikat i kończymy program kodem 1
createSeedData().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

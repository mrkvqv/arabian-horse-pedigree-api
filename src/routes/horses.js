const express = require('express');

const Horse = require('../models/horse');
const Country = require('../models/country');
const Breeder = require('../models/breeder');
// funkcja, sprawdzająca autoryzację administratora
const { requireAdmin } = require('../middleware/require-admin');
// funkcje, tworzące czytelne indefikatory
const { formatHorseIdentifier, formatBreederIdentifier } = require('../utils/identifiers');

const router = express.Router();
// pobieranie powiązanych danych (jakie dodatkowe dane trzeba pobrać oprócz tech indefikatorów)
const population = [
  { path: 'countryOfBirth', select: 'code' }, // tylko pole code
  { path: 'breeder', select: 'name country', populate: { path: 'country', select: 'code' } }, // hodowca + kod kraju
  { path: 'mother', select: 'name birthYear countryOfBirth', populate: { path: 'countryOfBirth', select: 'code' } }, // matka + rok + kod kraju
  { path: 'father', select: 'name birthYear countryOfBirth', populate: { path: 'countryOfBirth', select: 'code' } }, // ojcec + rok + kod kraju
];
// przed każdym endpointem uruchomiamy requireAdmin
router.use(requireAdmin);

// prosty obiek blędu
function problem(status, error) {
  return { status, error };
}
// przygotowanie kodu kraju
function countryCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

// krótka informacja o rodziców
function horseReference(horse) {
  if (!horse) return null;
  // pobieramu rok urodzienia z horse
  const code = horse.countryOfBirth.code;
  return {
    identifier: formatHorseIdentifier({ name: horse.name, countryCode: code, birthYear: horse.birthYear }),
    name: horse.name,
    birthYear: horse.birthYear,
    countryCode: code,
  };
}

// jeden węzel drzewa rodowodu
function pedigreeNode(horse) {
  const code = horse.countryOfBirth.code;
  return {
    identifier: formatHorseIdentifier({ name: horse.name, countryCode: code, birthYear: horse.birthYear }),
    name: horse.name,
    birthYear: horse.birthYear,
    sex: horse.sex,
    countryCode: code,
    mother: null,
    father: null,
  };
}

// funkcja odzczytująca parametr depth
function parseDepth(value) {
  if (value === undefined) return 3;
  const depth = Number(value);
  if (!Number.isInteger(depth) || depth < 0 || depth > 10) {
    return problem(400, 'depth must be an integer between 0 and 10.');
  }
  return depth;
}

// sprawdzenie numeru pokolenia potomkow
function parseGeneration(value) {
  const generation = Number(value);
  if (!Number.isInteger(generation) || generation < 1 || generation > 10) {
    return problem(400, 'generation must be an integer between 1 and 10.');
  }
  return generation;
}

// sprawdzenie płci
function parseSex(value) {
  if (!['klacz', 'ogier', 'wałach'].includes(value)) {
    return problem(400, 'sex must be klacz, ogier, or wałach.');
  }
  return value;
}
// budujemy drzewo rodowodu
async function buildPedigree(horse, depth) {
  const node = pedigreeNode(horse);
  if (depth === 0) return node;

  const [mother, father] = await Promise.all([
    horse.mother ? Horse.findById(horse.mother._id || horse.mother).populate('countryOfBirth', 'code') : null,
    horse.father ? Horse.findById(horse.father._id || horse.father).populate('countryOfBirth', 'code') : null,
  ]);
// powtarzamy funkcję dla rodziców
  const [motherTree, fatherTree] = await Promise.all([
    mother ? buildPedigree(mother, depth - 1) : null,
    father ? buildPedigree(father, depth - 1) : null,
  ]);

  node.mother = motherTree;
  node.father = fatherTree;
  return node;
}


// potomek ze wskazanego pokolenia
async function descendantAtGeneration(horse, generation) {
  // dotarliśmy do potrzebnego pokolenia i zwracamy aktualnego konia
  if (generation === 0)
    return [horse];

  // pobrac potomstwo
  const children = await Horse.find({
    $or: [
    { mother: horse._id },
    { father: horse._id },
    ],
}).populate(population);

  const descendantGroups = await Promise.all(
      children.map((child) => descendantAtGeneration(child, generation - 1)),
    );

    return descendantGroups.flat();
}

// przygotowujemy czytelną odpowiedź API zamiast technicznych ObjectId
function toHorseResponse(horse) {
  const code = horse.countryOfBirth.code;
  const breederCode = horse.breeder.country.code;
  return {
    identifier: formatHorseIdentifier({ name: horse.name, countryCode: code, birthYear: horse.birthYear }),
    name: horse.name,
    birthYear: horse.birthYear,
    sex: horse.sex,
    coat: horse.coat,
    countryCode: code,
    breeder: {
      identifier: formatBreederIdentifier({ name: horse.breeder.name, countryCode: breederCode }),
      name: horse.breeder.name,
      countryCode: breederCode,
    },
    mother: horseReference(horse.mother),
    father: horseReference(horse.father),
    notes: horse.notes,
  };
}

function toShortHorseResponse(horse) {
  const code = horse.countryOfBirth.code;
  return {
    identifier: formatHorseIdentifier({ name: horse.name, countryCode: code, birthYear: horse.birthYear }),
    name: horse.name,
    birthYear: horse.birthYear,
    sex: horse.sex,
    coat: horse.coat,
    countryCode: code,
  };
}

function sendProblem(response, value) {
  return response.status(value.status).json({ error: value.error });
}
// obsługa blędów Mongoose i MongoDB
function sendDatabaseError(response, error) {
  // niepoprawne dane
  if (error.name === 'ValidationError')
    return response.status(400).json({ error: error.message });
  // duplikat indefikatora
  if (error.code === 11000)
    return response.status(409).json({ error: 'A horse with this identifier already exists.' });
  return response.status(500).json({ error: 'Internal server error.' });
}

// funkcja otrzymuje kod kraju
async function findCountry(code) {
  if (!countryCode(code)) return problem(400, 'countryCode is required.');
  const country = await Country.findOne({ code: countryCode(code) });
  return country || problem(404, 'Country not found.');
}

// szukamy jednego hodowcy
async function findBreeder(reference) { // obiekt z danymi
  if (!reference?.name) return problem(400, 'breeder.name is required.');
  const filter = { name: reference.name.trim() };
  if (reference.countryCode) {
    const country = await findCountry(reference.countryCode);
    // jeśli krak istnieje, status nie będzie występował, będzie po prostu dokument Mongoose
    if (country.status) return country;
    filter.country = country._id;
  }
  const breeders = await Breeder.find(filter).populate('country', 'code');
  if (breeders.length === 0) return problem(404, 'Breeder not found.');
  if (breeders.length > 1) return problem(409, 'Breeder name is ambiguous. Add countryCode.');
  return breeders[0];
}

async function findHorse(reference) {
  if (!reference?.name) return problem(400, 'Horse name is required.');
  const filter = { name: reference.name.trim() };
  if (reference.birthYear !== undefined) {
    const year = Number(reference.birthYear);
    if (!Number.isInteger(year)) return problem(400, 'birthYear must be an integer.');
    filter.birthYear = year;
  }
  if (reference.countryCode) {
    const country = await findCountry(reference.countryCode);
    if (country.status) return country;
    filter.countryOfBirth = country._id;
  }
  const horses = await Horse.find(filter).populate(population);
  if (horses.length === 0) return problem(404, 'Horse not found.');
  if (horses.length > 1) return problem(409, 'Horse reference is ambiguous. Add birthYear or countryCode.');
  return horses[0];
}

// prygotowujemy dane do edycji lub do utworzenia
async function resolveHorseData(body) {
  const [birthCountry, breeder, mother, father] = await Promise.all([
    findCountry(body.countryCode),
    findBreeder(body.breeder),
    body.mother ? findHorse(body.mother) : null,
    body.father ? findHorse(body.father) : null,
  ]);
  for (const value of [birthCountry, breeder, mother, father]) {
    if (value?.status) return value;
  }
  return { birthCountry, breeder, mother, father };
}

// population - zasady pobierania
async function populateHorse(horse) {
  return horse.populate(population);
}


router.post('/', async (request, response) => {
  try {
    const data = await resolveHorseData(request.body);
    if (data.status) return sendProblem(response, data);
    const horse = await Horse.create({
      name: request.body.name,
      birthYear: request.body.birthYear,
      sex: request.body.sex,
      coat: request.body.coat,
      countryOfBirth: data.birthCountry._id,
      breeder: data.breeder._id,
      mother: data.mother?._id,
      father: data.father?._id,
      notes: request.body.notes,
    });
    // teraz mamy objectID, ale potzrebyjemy czytelnych danych
    await populateHorse(horse);
    return response.status(201).json(toHorseResponse(horse));
  } catch (error) { return sendDatabaseError(response, error); }
});

// lista wszytkich koni
router.get('/', async (request, response) => {
  const horses = await Horse.find().populate(population).sort({ name: 1, birthYear: 1 });
  return response.json(horses.map(toHorseResponse));
});
// rodowod
router.get('/:name/pedigree', async (request, response) => {
  const horse = await findHorse({ name: request.params.name, birthYear: request.query.birthYear, countryCode: request.query.countryCode });
  if (horse.status) return sendProblem(response, horse);

  const depth = parseDepth(request.query.depth);
  if (depth.status) return sendProblem(response, depth);

  return response.json({ depth, horse: await buildPedigree(horse, depth) });
});

router.get('/:name/descendants', async (request, response) => {
  // znajdujemy konia, od którego zaczynamy przechodzenie
  const horse = await findHorse({ name: request.params.name, birthYear: request.query.birthYear, countryCode: request.query.countryCode });
  if (horse.status) return sendProblem(response, horse);

  const generation = parseGeneration(request.query.generation);
  if (generation.status) return sendProblem(response, generation);

  const sex = parseSex(request.query.sex);
  if (sex.status) return sendProblem(response, sex);

  //  dane pokolenia i zostawiamy tylko konie wybranej płci
  const descendants = await descendantAtGeneration(horse, generation);
  const horses = descendants.filter((descendant) => descendant.sex === sex).map(toShortHorseResponse);

  // zwracamy parametry wyszukiwania oraz gotową listę koni
  return response.json({ generation, sex, horses });
});
// potomstwo
router.get('/:name/offspring', async (request, response) => {
  const horse = await findHorse({ name: request.params.name, birthYear: request.query.birthYear, countryCode: request.query.countryCode });
  if (horse.status) return sendProblem(response, horse);

  const filter = {
    $or: [
      { mother: horse._id },
      { father: horse._id }
    ]
  };

  if (request.query.sex) {
    if (!['klacz', 'ogier', 'wałach'].includes(request.query.sex)) {
      return response.status(400).json({ error: 'sex must be klacz, ogier, or wałach.' });
    }
    filter.sex = request.query.sex;
  }

  if (request.query.breederName) {
    const breeder = await findBreeder({ name: request.query.breederName, countryCode: request.query.breederCountryCode });
    if (breeder.status) return sendProblem(response, breeder);
    filter.breeder = breeder._id;
  } else if (request.query.breederCountryCode) {
    return response.status(400).json({ error: 'breederName is required when breederCountryCode is provided.' });
  }

  const offspring = await Horse.find(filter).populate(population).sort({ birthYear: 1, name: 1 });
  return response.json(offspring.map(toHorseResponse));
});

router.get('/:name', async (request, response) => {
  const horse = await findHorse({ name: request.params.name, birthYear: request.query.birthYear, countryCode: request.query.countryCode });
  // czy zmienna horse zwiera obiekt blędu
  if (horse.status) return sendProblem(response, horse);
  return response.json(toHorseResponse(horse));
});

router.put('/:name', async (request, response) => {
  try {
    const oldHorse = await findHorse({ name: request.params.name, birthYear: request.query.birthYear, countryCode: request.query.countryCode });
    if (oldHorse.status) return sendProblem(response, oldHorse);
    const data = await resolveHorseData(request.body);
    if (data.status) return sendProblem(response, data);
    Object.assign(oldHorse, {
      // podastawowe dane konia
      name: request.body.name,
      birthYear: request.body.birthYear,
      sex: request.body.sex,
      coat: request.body.coat,
      // powiązania przez ObjectID
      countryOfBirth: data.birthCountry._id,
      breeder: data.breeder._id,
      mother: data.mother?._id,
      father: data.father?._id,
      notes: request.body.notes,
    });
    await oldHorse.save();
    await populateHorse(oldHorse);
    return response.json(toHorseResponse(oldHorse));
  } catch (error) { return sendDatabaseError(response, error); }
});

router.delete('/:name', async (request, response) => {
  const horse = await findHorse({ name: request.params.name, birthYear: request.query.birthYear, countryCode: request.query.countryCode });
  if (horse.status) return sendProblem(response, horse);
  const hasChildren = await Horse.exists({ $or: [{ mother: horse._id }, { father: horse._id }] });
  if (hasChildren) return response.status(409).json({ error: 'Horse is used as a parent.' });
  await horse.deleteOne();
  return response.status(204).send();
});

module.exports = router;

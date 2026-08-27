const express = require('express');

const Horse = require('../models/horse');
const Country = require('../models/country');
const Breeder = require('../models/breeder');
const { requireAdmin } = require('../middleware/require-admin');
const { formatHorseIdentifier, formatBreederIdentifier } = require('../utils/identifiers');

const router = express.Router();
const population = [
  { path: 'countryOfBirth', select: 'code' },
  { path: 'breeder', select: 'name country', populate: { path: 'country', select: 'code' } },
  { path: 'mother', select: 'name birthYear countryOfBirth', populate: { path: 'countryOfBirth', select: 'code' } },
  { path: 'father', select: 'name birthYear countryOfBirth', populate: { path: 'countryOfBirth', select: 'code' } },
];

router.use(requireAdmin);

function problem(status, error) {
  return { status, error };
}

function countryCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function horseReference(horse) {
  if (!horse) return null;
  const code = horse.countryOfBirth.code;
  return {
    identifier: formatHorseIdentifier({ name: horse.name, countryCode: code, birthYear: horse.birthYear }),
    name: horse.name,
    birthYear: horse.birthYear,
    countryCode: code,
  };
}

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

function sendProblem(response, value) {
  return response.status(value.status).json({ error: value.error });
}

function sendDatabaseError(response, error) {
  if (error.name === 'ValidationError') return response.status(400).json({ error: error.message });
  if (error.code === 11000) return response.status(409).json({ error: 'A horse with this identifier already exists.' });
  return response.status(500).json({ error: 'Internal server error.' });
}

async function findCountry(code) {
  if (!countryCode(code)) return problem(400, 'countryCode is required.');
  const country = await Country.findOne({ code: countryCode(code) });
  return country || problem(404, 'Country not found.');
}

async function findBreeder(reference) {
  if (!reference?.name) return problem(400, 'breeder.name is required.');
  const filter = { name: reference.name.trim() };
  if (reference.countryCode) {
    const country = await findCountry(reference.countryCode);
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

async function populateHorse(horse) {
  return horse.populate(population);
}

router.post('/', async (request, response) => {
  try {
    const data = await resolveHorseData(request.body);
    if (data.status) return sendProblem(response, data);
    const horse = await Horse.create({
      name: request.body.name, birthYear: request.body.birthYear, sex: request.body.sex,
      coat: request.body.coat, countryOfBirth: data.birthCountry._id, breeder: data.breeder._id,
      mother: data.mother?._id, father: data.father?._id, notes: request.body.notes,
    });
    await populateHorse(horse);
    return response.status(201).json(toHorseResponse(horse));
  } catch (error) { return sendDatabaseError(response, error); }
});

router.get('/', async (request, response) => {
  const horses = await Horse.find().populate(population).sort({ name: 1, birthYear: 1 });
  return response.json(horses.map(toHorseResponse));
});

router.get('/:name', async (request, response) => {
  const horse = await findHorse({ name: request.params.name, birthYear: request.query.birthYear, countryCode: request.query.countryCode });
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
      name: request.body.name, birthYear: request.body.birthYear, sex: request.body.sex, coat: request.body.coat,
      countryOfBirth: data.birthCountry._id, breeder: data.breeder._id, mother: data.mother?._id,
      father: data.father?._id, notes: request.body.notes,
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

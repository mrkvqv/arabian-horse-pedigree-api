const express = require('express');

const Breeder = require('../models/breeder');
const Country = require('../models/country');
const Horse = require('../models/horse');
const { requireAdmin } = require('../middleware/require-admin');
// tworzymy imię + kraj
const { formatBreederIdentifier } = require('../utils/identifiers');

const router = express.Router();

router.use(requireAdmin);

function getCountryCode(code) {
  return code.trim().toUpperCase();
}

// to co zwracamy
function toBreederResponse(breeder) {
  return {
    identifier: formatBreederIdentifier({
      name: breeder.name,
      countryCode: breeder.country.code,
    }),
    name: breeder.name,
    countryCode: breeder.country.code,
    notes: breeder.notes,
  };
}

function sendDatabaseError(response, error) {
  // bad request
  if (error.name === 'ValidationError') {
    return response.status(400).json({ error: error.message });
  }

  if (error.code === 11000) { // bląd duplikatu
    return response.status(409).json({ error: 'A breeder with this name and country already exists.' });
  }

  return response.status(500).json({ error: 'Internal server error.' });
}

async function findBreeder(name, countryCode) {
  const filter = { name: name.trim() };

  if (countryCode) {
    const country = await Country.findOne({ code: getCountryCode(countryCode) });

    if (!country) {
      return { breeder: null };
    }

    filter.country = country._id;
  }

  const breeders = await Breeder.find(filter).populate('country', 'code');

  if (!countryCode && breeders.length > 1) {
    return { ambiguous: true };
  }

  return { breeder: breeders[0] || null };
}

// obsługa blędów wyszukiwania
function sendBreederLookupError(response, lookup) {
  if (lookup.ambiguous) {
    return response.status(409).json({ error: 'Breeder name is ambiguous. Add countryCode.' });
  }

  if (!lookup.breeder) {
    return response.status(404).json({ error: 'Breeder not found.' });
  }

  return null;
}

router.post('/', async (request, response) => {
  try {
    const country = await Country.findOne({ code: getCountryCode(request.body.countryCode) });

    if (!country) {
      return response.status(404).json({ error: 'Country not found.' });
    }

    const breeder = await Breeder.create({
      name: request.body.name,
      country: country._id,
      notes: request.body.notes,
    });

    await breeder.populate('country', 'code');
    return response.status(201).json(toBreederResponse(breeder));
  } catch (error) {
    return sendDatabaseError(response, error);
  }
});

router.get('/', async (request, response) => {
  const breeders = await Breeder.find().populate('country', 'code').sort({ name: 1 });
  return response.json(breeders.map(toBreederResponse));
});

router.get('/:name', async (request, response) => {
  const lookup = await findBreeder(request.params.name, request.query.countryCode);
  const errorResponse = sendBreederLookupError(response, lookup);

  if (errorResponse) {
    return errorResponse;
  }

  return response.json(toBreederResponse(lookup.breeder));
});

router.put('/:name', async (request, response) => {
  try {
    const lookup = await findBreeder(request.params.name, request.query.countryCode);
    const errorResponse = sendBreederLookupError(response, lookup);

    if (errorResponse) {
      return errorResponse;
    }

    const country = await Country.findOne({ code: getCountryCode(request.body.countryCode) });

    if (!country) {
      return response.status(404).json({ error: 'Country not found.' });
    }
    //zmieniamy name, id i (notes)
    lookup.breeder.name = request.body.name;
    lookup.breeder.country = country._id;
    lookup.breeder.notes = request.body.notes;
    // sapisujemu zmienionego hodowcę do bazy
    await lookup.breeder.save(); // uruchamia walidację modelu
    // zwracamy odpowiedź API z kodem kraju
    await lookup.breeder.populate('country', 'code');

    return response.json(toBreederResponse(lookup.breeder));
  } catch (error) {
    return sendDatabaseError(response, error);
  }
});

router.delete('/:name', async (request, response) => {
  const lookup = await findBreeder(request.params.name, request.query.countryCode);
  const errorResponse = sendBreederLookupError(response, lookup);

  if (errorResponse) {
    return errorResponse;
  }

  const hasHorses = await Horse.exists({ breeder: lookup.breeder._id });

  if (hasHorses) {
    return response.status(409).json({ error: 'Breeder is used by horses.' });
  }

  await lookup.breeder.deleteOne();
  return response.status(204).send();
});

module.exports = router;

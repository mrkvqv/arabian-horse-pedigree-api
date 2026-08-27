const express = require('express');

const Country = require('../models/country');
const Breeder = require('../models/breeder');
const Horse = require('../models/horse');
const { requireAdmin } = require('../middleware/require-admin');

const router = express.Router();

function toCountryResponse(country) {
  return {
    code: country.code,
    namePl: country.namePl,
  };
}

function getCode(code) {
  return code.trim().toUpperCase();
}

function sendDatabaseError(response, error) {
  if (error.name === 'ValidationError') {
    return response.status(400).json({ error: error.message });
  }

  if (error.code === 11000) {
    return response.status(409).json({ error: 'A country with this code already exists.' });
  }

  return response.status(500).json({ error: 'Internal server error.' });
}

router.post('/', requireAdmin, async (request, response) => {
  try {
    const country = await Country.create({
      code: request.body.code,
      namePl: request.body.namePl,
    });

    return response.status(201).json(toCountryResponse(country));
  } catch (error) {
    return sendDatabaseError(response, error);
  }
});

router.get('/', async (request, response) => {
  const countries = await Country.find().sort({ code: 1 });
  return response.json(countries.map(toCountryResponse));
});

router.get('/:code', async (request, response) => {
  const country = await Country.findOne({ code: getCode(request.params.code) });

  if (!country) {
    return response.status(404).json({ error: 'Country not found.' });
  }

  return response.json(toCountryResponse(country));
});

router.put('/:code', requireAdmin, async (request, response) => {
  try {
    const country = await Country.findOneAndUpdate(
      { code: getCode(request.params.code) },
      {
        code: request.body.code,
        namePl: request.body.namePl,
      },
      { returnDocument: 'after', runValidators: true },
    );

    if (!country) {
      return response.status(404).json({ error: 'Country not found.' });
    }

    return response.json(toCountryResponse(country));
  } catch (error) {
    return sendDatabaseError(response, error);
  }
});

router.delete('/:code', requireAdmin, async (request, response) => {
  const country = await Country.findOne({ code: getCode(request.params.code) });

  if (!country) {
    return response.status(404).json({ error: 'Country not found.' });
  }

  const [hasBreeders, hasHorses] = await Promise.all([
    Breeder.exists({ country: country._id }),
    Horse.exists({ countryOfBirth: country._id }),
  ]);

  if (hasBreeders || hasHorses) {
    return response.status(409).json({ error: 'Country is used by breeders or horses.' });
  }

  await country.deleteOne();
  return response.status(204).send();
});

module.exports = router;

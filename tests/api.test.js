require('dotenv').config({ quiet: true });

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const databaseUrl = new URL(process.env.MONGODB_URI);
databaseUrl.pathname = '/arabian_horse_pedigree_test';
process.env.MONGODB_URI = databaseUrl.toString();

const { app } = require('../src/server');
const { connectToDatabase } = require('../src/config/database');
const Admin = require('../src/models/admin');
const Country = require('../src/models/country');
const Breeder = require('../src/models/breeder');
const Horse = require('../src/models/horse');

let server;

function request(method, path, body, authenticated = false) {
  const payload = body ? JSON.stringify(body) : undefined;
  const headers = payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {};

  if (authenticated) {
    headers.Authorization = `Basic ${Buffer.from('test-admin:test-password').toString('base64')}`;
  }

  return new Promise((resolve, reject) => {
    const requestData = http.request({ hostname: '127.0.0.1', port: server.address().port, path, method, headers }, (response) => {
      let responseBody = '';
      response.on('data', (chunk) => { responseBody += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: responseBody ? JSON.parse(responseBody) : null }));
    });
    requestData.on('error', reject);
    if (payload) requestData.write(payload);
    requestData.end();
  });
}

test.before(async () => {
  await connectToDatabase();
  await mongoose.connection.dropDatabase();
  await Admin.create({ login: 'test-admin', passwordHash: await bcrypt.hash('test-password', 4) });
  server = app.listen(0);
  if (!server.listening) await new Promise((resolve) => server.once('listening', resolve));
});

test.after(async () => {
  await mongoose.connection.dropDatabase();
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
});

test('API authentication, country CRUD, validation, pedigree, and offspring', async (t) => {
  await t.test('protects country data and changes', async () => {
    const countries = await request('GET', '/countries');
    const authorizedCountries = await request('GET', '/countries', undefined, true);
    const unauthorized = await request('POST', '/countries', { code: 'PL', namePl: 'Polska' });

    assert.equal(countries.status, 401);
    assert.equal(authorizedCountries.status, 200);
    assert.deepEqual(authorizedCountries.body, []);
    assert.equal(unauthorized.status, 401);
  });

  await t.test('creates, updates, and deletes a country', async () => {
    const created = await request('POST', '/countries', { code: 'PL', namePl: 'Polska' }, true);
    const updated = await request('PUT', '/countries/PL', { namePl: 'Rzeczpospolita Polska' }, true);
    const deleted = await request('DELETE', '/countries/PL', undefined, true);

    assert.equal(created.status, 201);
    assert.equal(updated.status, 200);
    assert.equal(updated.body.namePl, 'Rzeczpospolita Polska');
    assert.equal(deleted.status, 204);
  });

  await t.test('rejects invalid country data', async () => {
    const response = await request('POST', '/countries', { code: 'P', namePl: 'Nieprawidłowy kraj' }, true);

    assert.equal(response.status, 400);
    assert.equal(typeof response.body.error, 'string');
  });

  await t.test('enforces parent rules and special pedigree queries', async () => {
    const country = await Country.create({ code: 'PL', namePl: 'Polska' });
    const breeder = await Breeder.create({ name: 'Test breeder', country: country._id });
    const invalidMother = await Horse.create({
      name: 'Invalid mother', birthYear: 1998, sex: 'ogier', coat: 'siwa', countryOfBirth: country._id, breeder: breeder._id,
    });

    await assert.rejects(
      Horse.create({
        name: 'Invalid child', birthYear: 2010, sex: 'ogier', coat: 'kara', countryOfBirth: country._id,
        breeder: breeder._id, mother: invalidMother._id,
      }),
      (error) => error.name === 'ValidationError' && Boolean(error.errors.mother),
    );

    const mother = await Horse.create({
      name: 'Mother', birthYear: 1998, sex: 'klacz', coat: 'siwa', countryOfBirth: country._id, breeder: breeder._id,
    });
    const father = await Horse.create({
      name: 'Father', birthYear: 1997, sex: 'ogier', coat: 'gniada', countryOfBirth: country._id, breeder: breeder._id,
    });
    await Horse.create({
      name: 'Child one', birthYear: 2010, sex: 'ogier', coat: 'kara', countryOfBirth: country._id,
      breeder: breeder._id, mother: mother._id, father: father._id,
    });
    await Horse.create({
      name: 'Child two', birthYear: 2011, sex: 'klacz', coat: 'kasztanowata', countryOfBirth: country._id,
      breeder: breeder._id, father: father._id,
    });

    const pedigree = await request('GET', '/horses/Child%20one/pedigree?birthYear=2010&countryCode=PL&depth=1', undefined, true);
    const offspring = await request('GET', '/horses/Father/offspring?birthYear=1997&countryCode=PL&sex=klacz', undefined, true);

    assert.equal(pedigree.status, 200);
    assert.equal(pedigree.body.horse.mother.name, 'Mother');
    assert.equal(pedigree.body.horse.father.name, 'Father');
    assert.equal(offspring.status, 200);
    assert.equal(offspring.body.length, 1);
    assert.equal(offspring.body[0].name, 'Child two');
  });

  await t.test('returns JSON for an unknown route', async () => {
    const response = await request('GET', '/unknown-route');

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: 'Not found.' });
  });
});

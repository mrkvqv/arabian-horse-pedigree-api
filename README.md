# Arabian Horse Pedigree API

REST API for an Arabian horse pedigree database. The project uses Node.js, Express, MongoDB, Mongoose, Faker, and Passport.js.

## Requirements

- Node.js 24 or newer
- Docker Desktop

## Run from a clean clone

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local environment file:

   ```bash
   cp .env.example .env
   ```

3. In `.env`, choose private values for `MONGO_ROOT_PASSWORD`, `ADMIN_LOGIN`, and `ADMIN_PASSWORD`. The password in `MONGODB_URI` must match `MONGO_ROOT_PASSWORD`.

4. Start MongoDB in Docker:

   ```bash
   docker compose up -d
   ```

5. Create the first administrator:

   ```bash
   npm run create:admin
   ```

6. Optionally create demonstration data with six ancestor generations:

   ```bash
   npm run seed
   ```

7. Start the API:

   ```bash
   npm start
   ```

The API is available at `http://localhost:3000`.

For development with automatic restart after a file change:

```bash
npm run dev
```

## Docker commands

```bash
docker compose ps
docker compose down
```

MongoDB data is kept in the Docker volume `mongodb_data`, so `docker compose down` does not remove it.

## Authentication

All API routes except `GET /health` require an administrator. Authentication is implemented with Passport.js and HTTP Basic Auth.

In Postman, choose **Authorization → Basic Auth** and enter the administrator login and password from `.env`.

With curl:

```bash
curl -u admin:your-admin-password http://localhost:3000/admin/health
```

The administrator password is stored in MongoDB only as a bcrypt hash.

## Public identifiers

The API never accepts or returns MongoDB `ObjectId` values.

- Horse: `name countryCode birthYear`, for example `Amir PL 2020`.
- Breeder: `name countryCode`, for example `Al Buraq PL`.

Use a URL-encoded name in a path. For example, `Amir Al Arab` becomes `Amir%20Al%20Arab`.

## Demonstration data

`npm run seed` creates:

- three countries and three demonstration breeders;
- 127 horses;
- one horse with exactly six levels of ancestors;
- valid mother/father sex and parent age differences from 3 to 21 years.

The script removes only its own previous demonstration horses and breeders. It does not remove administrators or normal project data. After running it, the terminal prints an identifier that can be used in Postman and the HTML visualization.

## HTML pedigree visualization

Open this page after starting the server:

```text
http://localhost:3000/pedigree.html
```

Enter a horse name, birth year, country code, generation depth, and administrator credentials. The page shows each generation in a separate block and labels every relationship, for example `Matka → Ojciec → Wybrany koń`.

## Tests

Run all automated tests:

```bash
npm test
```

Tests use a separate MongoDB database named `arabian_horse_pedigree_test` and delete only this test database after completion. They verify authentication, country CRUD, validation, pedigree rules, pedigree retrieval, offspring retrieval, and JSON errors.

## API

All endpoints below require Basic Auth unless marked **Public**.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | **Public.** Checks whether the server is running. |
| GET | `/admin/health` | Checks administrator authentication. |
| GET | `/countries` | Gets all countries. |
| POST | `/countries` | Creates a country. |
| GET | `/countries/:code` | Gets one country by ISO code. |
| PUT | `/countries/:code` | Updates a country. |
| DELETE | `/countries/:code` | Deletes an unused country. |
| GET | `/breeders` | Gets all breeders. |
| POST | `/breeders` | Creates a breeder. |
| GET | `/breeders/:name?countryCode=PL` | Gets a breeder. `countryCode` is required only when the name is ambiguous. |
| PUT | `/breeders/:name?countryCode=PL` | Updates a breeder. |
| DELETE | `/breeders/:name?countryCode=PL` | Deletes an unused breeder. |
| GET | `/horses` | Gets all horses. |
| POST | `/horses` | Creates a horse. |
| GET | `/horses/:name?birthYear=2020&countryCode=PL` | Gets one horse. Add parameters when the name is ambiguous. |
| PUT | `/horses/:name?birthYear=2020&countryCode=PL` | Updates a horse. |
| DELETE | `/horses/:name?birthYear=2020&countryCode=PL` | Deletes a horse that is not a parent. |
| GET | `/horses/:name/pedigree?birthYear=2020&countryCode=PL&depth=3` | Gets an ancestor tree. |
| GET | `/horses/:name/offspring?birthYear=2020&countryCode=PL&sex=klacz&breederName=Al%20Buraq&breederCountryCode=PL` | Gets offspring with optional sex and breeder filters. |

### Create a country

```bash
curl -u admin:your-admin-password \
  -X POST http://localhost:3000/countries \
  -H 'Content-Type: application/json' \
  -d '{"code":"PL","namePl":"Polska"}'
```

### Create a breeder

```json
{
  "name": "Al Buraq",
  "countryCode": "PL",
  "notes": "Optional notes"
}
```

Send this body with `POST /breeders`.

### Create a horse

Send this body with `POST /horses`:

```json
{
  "name": "Amir",
  "birthYear": 2020,
  "sex": "ogier",
  "coat": "siwa",
  "countryCode": "PL",
  "breeder": {
    "name": "Al Buraq",
    "countryCode": "PL"
  },
  "mother": {
    "name": "Maja",
    "birthYear": 2010,
    "countryCode": "PL"
  },
  "father": {
    "name": "Bask",
    "birthYear": 2008,
    "countryCode": "PL"
  },
  "notes": "Optional notes"
}
```

`mother` and `father` are optional. The API validates that a mother is `klacz`, a father is `ogier`, and that each specified parent was 3–21 years old when the foal was born.

### Get a pedigree in Postman

Use method **GET**, Basic Auth, and these query parameters:

| Key | Example value |
|---|---|
| `birthYear` | `2020` |
| `countryCode` | `PL` |
| `depth` | `6` |

Example URL:

```text
http://localhost:3000/horses/Amir/pedigree?birthYear=2020&countryCode=PL&depth=6
```

## Error format

Errors are returned as JSON:

```json
{
  "error": "Country not found."
}
```

Typical status codes are `400` for invalid data, `401` for missing or invalid administrator credentials, `404` for a missing resource, and `409` for a duplicate or a relation that prevents deletion.

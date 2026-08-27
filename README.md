# Arabian Horse Pedigree API

REST API for an Arabian horse pedigree database.

## Public identifiers

The API will not expose or accept MongoDB `ObjectId` values.

- A horse is identified as `name countryCode birthYear`, for example `Amir PL 2020`.
- A breeder is identified as `name countryCode`, for example `Al Buraq PL`.

These are display and API identifiers created from regular fields. They are not stored as separate technical keys in MongoDB.

## Requirements

- Node.js 24 or newer
- Docker Desktop

## Start MongoDB

1. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

2. Change `MONGO_ROOT_PASSWORD` in `.env` to a private password.
3. Use the same password in `MONGODB_URI` in `.env`.
4. Start MongoDB:

   ```bash
   docker compose up -d
   ```

5. Check that the container is running:

   ```bash
   docker compose ps
   ```

## Start the API

MongoDB must be running before the API starts.

```bash
npm start
```

The server connects to MongoDB first and then starts at `http://localhost:3000`.

## Administrator authentication

Set `ADMIN_LOGIN` and `ADMIN_PASSWORD` in your local `.env` file, then create the first administrator:

```bash
npm run create:admin
```

Protected API routes use HTTP Basic Auth. For example, after starting the API:

```bash
curl -u admin:your-admin-password http://localhost:3000/admin/health
```

The password is stored in MongoDB only as a hash. Basic Auth is appropriate here for local development and the exam project; a production application must use HTTPS.

## Stop MongoDB

```bash
docker compose down
```

The MongoDB data is stored in the Docker volume `mongodb_data`, so it remains available after `docker compose down`.

# Arabian Horse Pedigree API

REST API for an Arabian horse pedigree database.

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

## Stop MongoDB

```bash
docker compose down
```

The MongoDB data is stored in the Docker volume `mongodb_data`, so it remains available after `docker compose down`.

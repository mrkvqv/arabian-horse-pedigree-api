// importujemy Express do tworzenia serwera HTTP
const express = require('express');
// wczytujemy zmienne z pliku .env
require('dotenv').config({ quiet: true });
// importujemy Passport do sprawdzania administratora
const passport = require('./config/passport');

// importujemy połączenie z bazą, middleware i trasy API
const { connectToDatabase } = require('./config/database');
const { requireAdmin } = require('./middleware/require-admin');
// importujemy pliki z operacjami CRUD
const countryRoutes = require('./routes/countries');
const breederRoutes = require('./routes/breeders');
const horseRoutes = require('./routes/horses');

// tworzymy aplikację Express
const app = express();
// wybieramy port z .env lub domyślnie 3000
const port = process.env.PORT || 3000;

// odczytujemy dane JSON wysłane w body żądania
app.use(express.json());
// uruchamiamy Passport przed chronionymi trasami
app.use(passport.initialize());
// udostępniamy stronę HTML i jej pliki z folderu public
app.use(express.static('public'));

// sprawdzamy, czy serwer działa
app.get('/health', (request, response) => {
  response.status(200).json({ status: 'ok' });
});

// sprawdzamy serwer i autoryzację administratora
app.get('/admin/health', requireAdmin, (request, response) => {
  response.status(200).json({ status: 'ok', admin: request.admin.login });
});

// przekazujemy żądania do odpowiednich routerów
app.use('/countries', countryRoutes);
app.use('/breeders', breederRoutes);
app.use('/horses', horseRoutes);

// zwracamy błąd JSON dla nieistniejącego adresu
app.use((request, response) => {
  response.status(404).json({ error: 'Not found.' });
});

// zwracamy błąd 500 dla nieoczekiwanego błędu serwera
app.use((error, request, response, next) => {
  if (response.headersSent) return next(error);
  return response.status(500).json({ error: 'Internal server error.' });
});

// łączymy się z MongoDB i uruchamiamy serwer
async function startServer() {
  await connectToDatabase();

  return app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

// wykonujemy start tylko po bezpośrednim uruchomieniu tego pliku
if (require.main === module) {
  startServer().catch((error) => {
    console.error('Unable to start server:', error.message);
    process.exit(1);
  });
}

// eksportujemy aplikację do testów i funkcję do uruchamiania serwera
module.exports = { app, startServer };

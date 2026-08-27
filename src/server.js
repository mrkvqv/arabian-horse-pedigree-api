const express = require('express');
require('dotenv').config({ quiet: true });

const { connectToDatabase } = require('./config/database');
const { requireAdmin } = require('./middleware/require-admin');

const app = express();
const port = process.env.PORT || 3000;

app.get('/health', (request, response) => {
  response.status(200).json({ status: 'ok' });
});

app.get('/admin/health', requireAdmin, (request, response) => {
  response.status(200).json({ status: 'ok', admin: request.admin.login });
});

async function startServer() {
  await connectToDatabase();

  return app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Unable to start server:', error.message);
    process.exit(1);
  });
}

module.exports = { app, startServer };

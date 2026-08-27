const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.get('/health', (request, response) => {
  response.status(200).json({ status: 'ok' });
});

const server = app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

module.exports = { app, server };

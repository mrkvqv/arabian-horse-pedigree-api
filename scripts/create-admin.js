require('dotenv').config({ quiet: true });

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const { connectToDatabase } = require('../src/config/database');
const Admin = require('../src/models/admin');

async function createAdmin() {
  const login = process.env.ADMIN_LOGIN?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!login || !password) {
    throw new Error('Set ADMIN_LOGIN and ADMIN_PASSWORD in .env first.');
  }

  await connectToDatabase();

  try {
    const existingAdmin = await Admin.findOne({ login });

    if (existingAdmin) {
      throw new Error(`Administrator "${login}" already exists.`);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await Admin.create({ login, passwordHash });
    console.log(`Administrator "${login}" was created.`);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

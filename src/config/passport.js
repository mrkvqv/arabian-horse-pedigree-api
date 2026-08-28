const bcrypt = require('bcryptjs');
const passport = require('passport');
const { BasicStrategy } = require('passport-http');

const Admin = require('../models/admin');

passport.use(new BasicStrategy(async (login, password, done) => {
  try {
    const admin = await Admin.findOne({ login: login.trim().toLowerCase() });

    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      return done(null, false);
    }

    return done(null, admin);
  } catch (error) {
    return done(error);
  }
}));

module.exports = passport;

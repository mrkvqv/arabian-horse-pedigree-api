const bcrypt = require('bcryptjs');
const Admin = require('../models/admin');

async function requireAdmin(request, response, next) {
  const authorization = request.get('authorization');

  if (!authorization?.startsWith('Basic ')) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  const [login, password] = Buffer.from(authorization.slice(6), 'base64')
    .toString()
    .split(':');

  if (!login || !password) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  const admin = await Admin.findOne({ login: login?.trim().toLowerCase() });

  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  request.admin = admin;
  return next();
}

module.exports = { requireAdmin };

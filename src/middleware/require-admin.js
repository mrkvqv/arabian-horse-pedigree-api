const bcrypt = require('bcryptjs');
const Admin = require('../models/admin');

function sendUnauthorized(response) {
  response.set('WWW-Authenticate', 'Basic realm="Arabian Horse Pedigree API"');
  return response.status(401).json({ error: 'Administrator credentials are required.' });
}

async function requireAdmin(request, response, next) {
  const authorization = request.get('authorization');

  if (!authorization?.startsWith('Basic ')) {
    return sendUnauthorized(response);
  }

  const decodedCredentials = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
  const separatorIndex = decodedCredentials.indexOf(':');

  if (separatorIndex <= 0) {
    return sendUnauthorized(response);
  }

  const login = decodedCredentials.slice(0, separatorIndex).trim().toLowerCase();
  const password = decodedCredentials.slice(separatorIndex + 1);

  try {
    const admin = await Admin.findOne({ login });
    const passwordMatches = admin && (await bcrypt.compare(password, admin.passwordHash));

    if (!passwordMatches) {
      return sendUnauthorized(response);
    }

    request.admin = { login: admin.login };
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { requireAdmin };

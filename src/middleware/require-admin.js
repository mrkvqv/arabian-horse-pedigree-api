const passport = require('../config/passport');

function requireAdmin(request, response, next) {
  return passport.authenticate('basic', { session: false }, (error, admin) => {
    if (error) return next(error);
    if (!admin) return response.status(401).json({ error: 'Unauthorized' });
    request.admin = admin;
    return next();
  })(request, response, next);
}

module.exports = { requireAdmin };

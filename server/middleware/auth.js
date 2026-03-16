const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  const token = req.header('x-auth-token');
  
  if (!token || token === 'undefined' || token === 'null') {
    return next();
  }
  
  try {
    console.log(`🔑 Verifying token for ${req.method} ${req.originalUrl}`);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwtSecret');
    
    req.user = decoded.user;
    console.log(`✅ Authentication successful for user ${req.user.id} - ${req.method} ${req.originalUrl}`);
    next();
  } catch (err) {
    console.warn(`⚠️ Ignoring invalid token for ${req.method} ${req.originalUrl}: ${err.message}`);
    next();
  }
};

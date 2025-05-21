const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');
  
  // Check if no token
  if (!token) {
    console.error(`🔒 Authentication error: No token provided for ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ message: 'No token, authorization denied' });
  }
  
  try {
    // Verify token
    console.log(`🔑 Verifying token for ${req.method} ${req.originalUrl}`);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwtSecret');
    
    // Set user id in request
    req.user = decoded.user;
    console.log(`✅ Authentication successful for user ${req.user.id} - ${req.method} ${req.originalUrl}`);
    next();
  } catch (err) {
    console.error(`🔒 Authentication error: Invalid token for ${req.method} ${req.originalUrl}`, err.message);
    res.status(401).json({ message: 'Token is not valid' });
  }
}; 
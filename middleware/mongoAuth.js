const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to protect routes
exports.protect = async (req, res, next) => {
  let token;

  // Check if token exists in headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Get token from header
    token = req.headers.authorization.split(' ')[1];
  }

  // Check if token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from the token
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or token is invalid',
      });
    }

    // Check if user has an active session (single device login enforcement)
    if (!user.sessionToken) {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please login again',
      });
    }

    // Validate that the JWT sessionToken matches the stored sessionToken
    if (decoded.sessionToken !== user.sessionToken) {
      return res.status(401).json({
        success: false,
        message: 'Session invalid. Another device has logged in.',
      });
    }

    // Set user in request object
    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      avatar: user.avatar
    };

    next();
  } catch (error) {
    let message = 'Invalid access token';

    if (error.name === 'TokenExpiredError') {
      message = 'Access token expired. Please login again';
    } else if (error.name === 'JsonWebTokenError') {
      message = 'Access token is malformed or has an invalid signature';
    } else if (error.name === 'NotBeforeError') {
      message = 'Access token is not active yet';
    }

    return res.status(401).json({
      success: false,
      message,
    });
  }
};

// Middleware to check user role
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }
    next();
  };
};

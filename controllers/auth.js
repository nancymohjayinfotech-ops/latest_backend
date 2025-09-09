const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const client = new OAuth2Client();

const GOOGLE_CLIENT_IDS = [
  process.env.GOOGLE_WEB_CLIENT_ID,
  process.env.GOOGLE_ANDROID_CLIENT_ID
];

// Generate access token (15 minutes)
const generateAccessToken = (id, sessionToken) => {
  return jwt.sign({ id, sessionToken }, process.env.JWT_SECRET, { expiresIn: '1d' });
};

// Generate refresh token (7 days)
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Generate session token
const generateSessionToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Phone validation function
const validatePhoneNumber = (phone) => {
  // Convert to string if it's not already
  const phoneStr = String(phone || '');
  // Basic phone validation - adjust regex based on your requirements
  const phoneRegex = /^[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneStr.replace(/[\s-()]/g, ''));
};

// SMS placeholder function
const sendSms = async (phone, otp) => {
  // Placeholder for SMS service integration
  console.log(`SMS to ${phone}: Your OTP is ${otp}`);
  // In production, integrate with SMS service like Twilio, AWS SNS, etc.
  return true;
};


// Send OTP to phone number
exports.sendOtp = async (req, res) => {
  try {
    const { phoneNumber, role } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Validate phone number format
    if (!validatePhoneNumber(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    // Validate role if provided
    const validRoles = ['admin', 'instructor', 'student', 'event'];
    const userRole = role && validRoles.includes(role) ? role : 'student'; // Default to student if invalid

    // Clean phone number
    const cleanPhone = String(phoneNumber || '').replace(/[\s-()]/g, '');

    // Find or create user
    let user = await User.findOne({ phoneNumber: cleanPhone });

    if (user && user.role !== userRole) {
      return res.status(400).json({
        success: false,
        message: `Phone number already registered`
      });
    }
    
    if (!user) {
      // Create new user with phone number
      user = new User({
        phoneNumber: cleanPhone,
        name: `User_${cleanPhone.slice(-4)}`, // Temporary name
        role: userRole
      });
    }


    // Check rate limiting - max 3 attempts in 10 minutes
    const now = new Date();
    if (user.otpAttemptsExpiry && user.otpAttemptsExpiry > now) {
      if (user.otpAttempts >= 3) {
        return res.status(429).json({
          success: false,
          message: 'Too many OTP requests. Please try again later.'
        });
      }
    } else {
      // Reset attempts if expired
      user.otpAttempts = 0;
      user.otpAttemptsExpiry = new Date(now.getTime() + 10 * 60 * 1000);
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hash OTP
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);
    
    // Set OTP expiry (2 minutes)
    const otpExpiry = new Date(now.getTime() + 2 * 60 * 1000);
    
    // Update user with OTP data
    user.otpHash = hashedOtp;
    user.otpExpiry = otpExpiry;
    user.otpAttempts += 1;
    
    await user.save();

    // Send OTP via SMS
    await sendSms(cleanPhone, otp);

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        phoneNumber: cleanPhone,
        expiresIn: 120, // seconds
        otp
      }
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending OTP',
      error: error.message
    });
  }
};

// Verify OTP and login
exports.verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required'
      });
    }

    // Clean phone number
    const cleanPhone = String(phoneNumber || '').replace(/[\s-()]/g, '');

    // Find user
    const user = await User.findOne({ phoneNumber: cleanPhone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if OTP exists and is not expired
    if (!user.otpHash || !user.otpExpiry || new Date() > user.otpExpiry) {
      return res.status(400).json({
        success: false,
        message: 'OTP expired or not found'
      });
    }

    // Verify OTP
    const isMatch = await bcrypt.compare(otp, user.otpHash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Generate session token first
    const sessionToken = generateSessionToken();
    // Generate tokens with session reference
    const accessToken = generateAccessToken(user._id, sessionToken);
    const refreshToken = generateRefreshToken(user._id);
    
    // Calculate refresh token expiry (7 days from now)
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);
    
    // Clear OTP data and update session (single device login)
    user.otpHash = null;
    user.otpExpiry = null;
    user.otpAttempts = 0;
    user.otpAttemptsExpiry = null;
    user.sessionToken = sessionToken;
    user.refreshToken = refreshToken;
    user.refreshTokenExpiry = refreshTokenExpiry;
    
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying OTP',
      error: error.message
    });
  }
};

// Google OAuth login
exports.googleLogin = async (req, res) => {
  const { idToken,role } = req.body;
  try {
    // Check if idToken exists
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'No ID token provided',
      });
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_IDS,
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub } = payload;

    // Find user by email
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user
      user = new User({
        name,
        email,
        googleId: sub,
        avatar: picture,
        role: role,
      });
    }

    // Generate session token first
    const sessionToken = generateSessionToken();
    // Generate tokens with session reference
    const accessToken = generateAccessToken(user._id, sessionToken);
    const refreshToken = generateRefreshToken(user._id);
    
    // Calculate refresh token expiry (7 days from now)
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);
    
    // Update session (single device login)
    user.sessionToken = sessionToken;
    user.refreshToken = refreshToken;
    user.refreshTokenExpiry = refreshTokenExpiry;
    
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Google login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          avatar: user.avatar
        }
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid Google token',
      error: error.message,
    });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          avatar: user.avatar,
          bio: user.bio,
          college: user.college,
          studentId: user.studentId,
          address: user.address
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// Logout endpoint
exports.logout = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Clear session token and refresh token
    await User.findByIdAndUpdate(userId, {
      sessionToken: null,
      refreshToken: null,
      refreshTokenExpiry: null
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout',
      error: error.message
    });
  }
};

// Admin registration (for initial setup only)
exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, phoneNumber, role = 'admin' } = req.body;

    // Validate required fields
    if (!name || (!email && !phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name and either email or phone number'
      });
    }

    // Check if user already exists
    let existingUser = null;
    if (email) {
      existingUser = await User.findOne({ email });
    }
    if (!existingUser && phoneNumber) {
      existingUser = await User.findOne({ phoneNumber });
    }

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with that email or phone number'
      });
    }

    // Create admin user
    const user = new User({
      name,
      email,
      phoneNumber,
      role
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during registration',
      error: error.message
    });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
      });
    }
    
    // Verify the refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }
    
    // Find user with this refresh token and check if it's still valid
    const user = await User.findById(decoded.id);
    
    if (!user || user.refreshToken !== refreshToken || 
        new Date(user.refreshTokenExpiry) < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token or token expired',
      });
    }
    
    // Generate new access token with current session token
    const accessToken = generateAccessToken(user._id, user.sessionToken);
    
    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

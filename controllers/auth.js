const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const { sendNotification } = require('../services/notificationService');

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

const validatePhoneNumber = (phone, minLength = 10, maxLength = 10) => {
  const phoneStr = String(phone || '').replace(/[\s-()]/g, '');
  const phoneRegex = new RegExp(`^[0-9]{${minLength},${maxLength}}$`);
  return phoneRegex.test(phoneStr);
};

// SMS placeholder function
const sendSms = async (phone, otp) => {
  // Placeholder for SMS service integration
  console.log(`SMS to ${phone}: Your OTP is ${otp}`);
  // In production, integrate with SMS service like Twilio, AWS SNS, etc.
  return true;
};


// Signup with phone number and role
exports.signupWithPhone = async (req, res) => {
  try {
    console.log("--- 1. Signup request received ---");
    const { phoneNumber, role } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Role is required'
      });
    }

    // Validate phone number format
    if (!validatePhoneNumber(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    // Validate role
    const validRoles = ['instructor', 'student', 'event'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be one of: instructor, student, event'
      });
    }

    // Clean phone number
    const cleanPhone = String(phoneNumber || '').replace(/[\s-()]/g, '');

    // Check if user already exists
    const existingUser = await User.findOne({ phoneNumber: cleanPhone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this phone number already exists'
      });
    }

    // Create new user
    const user = new User({
      phoneNumber: cleanPhone,
      name: `User_${cleanPhone.slice(-4)}`, // Temporary name
      role: role,
      isVerified: !['event', 'instructor'].includes(role) // Auto-verify students and admins
    });

    await user.save();
    console.log(`--- 2. New user ${user.name} saved successfully ---`);

    try {
      console.log("--- 3. Starting notification logic ---");
      if (user.role === 'student' || user.role === 'instructor') {
        const admins = await User.find({ role: 'admin' }).select('_id');
        console.log(`--- 4. Found ${admins.length} admin(s) ---`);
        const instructors = await User.find({ role: 'instructor' }).select('_id');
        console.log(`--- 5. Found ${instructors.length} instructor(s) ---`);

          // 1. Notify Admins
        if (admins.length > 0) {
          console.log("--- 6. Preparing to send notification to admins... ---");
              await sendNotification({
                  recipients: admins.map(a => a._id),
                  sender: user._id,
                  type: 'NEW_STUDENT_REGISTERED',
                  title: 'New User Signup',
                  message: `A new ${user.role}, ${user.name}, has just signed up with a phone number.`,
                  data: { userId: user._id.toString() }
              });
              console.log("--- 7. Notification sent to admins ---");
          }

          // 2. Notify Instructors (if new user is a student)
        if (user.role === 'student' && instructors.length > 0) {
          console.log("--- 8. Preparing to send notification to instructors... ---");
              await sendNotification({
                  recipients: instructors.map(i => i._id),
                  sender: user._id,
                  type: 'NEW_STUDENT_REGISTERED',
                  title: 'A New Learner Joined!',
                  message: `A new student, ${user.name}, has joined MiSkills.`,
                  data: { userId: user._id.toString() }
              });
              console.log("--- 9. Notification sent to instructors ---");
          }

          // 3. Send Welcome Notification to the new user
          console.log("--- 10. Preparing to send welcome notification to the new user... ---");
          await sendNotification({
              recipients: [user._id],
              sender: null,
              type: user.role === 'student' ? 'WELCOME_STUDENT' : 'WELCOME_INSTRUCTOR',
              title: 'Welcome to MiSkills!',
              message: `Hi ${user.name}, welcome! Your account has been created. Let's start your Journey`,
          });
          console.log("--- 11. Welcome notification sent ---");
      }
    } catch (notificationError) {
      console.error('--- !!! NOTIFICATION LOGIC FAILED !!! ---:', notificationError);
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        userId: user._id,
        phoneNumber: cleanPhone,
        role: role,
        message: 'You can now login using OTP'
      }
    });
  } catch (error) {
    console.error('--- !!! SIGNUP FAILED CRITICALLY !!! ---:', error);
    res.status(500).json({
      success: false,
      message: 'Error during signup',
      error: error.message
    });
  }
};

// Send OTP to phone number (for login)
exports.sendOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

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

    // Clean phone number
    const cleanPhone = String(phoneNumber || '').replace(/[\s-()]/g, '');

    // Find existing user
    let user = await User.findOne({ phoneNumber: cleanPhone });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please signup first.'
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

    // ✅ CORRECTED: Notification is sent AFTER user is found and OTP is verified.
    try {
      await sendNotification({
          recipients: [user._id],
          sender: null,
          type: 'GENERAL',
          title: `Welcome Back, ${user.name}!`,
          message: "It's great to see you again. Let's get started!",
          data: { userId: user._id.toString() }
      });
    } catch (e) {
        console.error("Error sending login notification:", e);
    }

    // Generate session token first
    const sessionToken = generateSessionToken();
    const accessToken = generateAccessToken(user._id, sessionToken);
    const refreshToken = generateRefreshToken(user._id);
    
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);
    
    // Clear OTP data and update session
    user.otpHash = null;
    user.otpExpiry = null;
    user.otpAttempts = 0;
    user.otpAttemptsExpiry = null;
    user.sessionToken = sessionToken;
    user.refreshToken = refreshToken;
    user.refreshTokenExpiry = refreshTokenExpiry;
    
    await user.save();

    // Check profile completeness for instructor/event/student users
    let profileStatus = {};
    if (['instructor', 'event', 'student'].includes(user.role)) {
      if (user.role === 'student') {
        const requiredFields = ['college', 'state', 'city', 'dob'];
        let missingFields = requiredFields.filter(field => !user[field] || user[field].trim() === '');
        if (user.googleId && (!user.phoneNumber || user.phoneNumber.trim() === '')) {
          missingFields.push('phoneNumber');
        }
        if (user.phoneNumber && !user.googleId && (!user.email || user.email.trim() === '')) {
          missingFields.push('email');
        }
        profileStatus = {
          isProfileComplete: missingFields.length === 0,
          isCollegeSet: !!(user.college && user.studentId)
        };
      } else {
        const requiredFields = ['name', 'bio', 'dob', 'address', 'state', 'city'];
        let missingFields = requiredFields.filter(field => !user[field] || user[field].trim() === '');
        if (user.googleId && (!user.phoneNumber || user.phoneNumber.trim() === '')) {
          missingFields.push('phoneNumber');
        }
        if (user.phoneNumber && !user.googleId && (!user.email || user.email.trim() === '')) {
          missingFields.push('email');
        }
        profileStatus = {
          isProfileComplete: missingFields.length === 0,
          isVerified: user.isVerified,
          verificationRequested: user.verificationRequested || false
        };
      }
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user,
        ...((['instructor', 'event', 'student'].includes(user.role)) && { profileStatus })
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

exports.adminLogin = async (req, res) => {
  try {
      const { email, password } = req.body;
      if (!email || !password) {
          return res.status(400).json({ success: false, message: 'Email and password are required.' });
      }
      const user = await User.findOne({ email, role: 'admin' });
      if (!user) {
          return res.status(401).json({ success: false, message: 'Invalid credentials or not an admin.' });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
          return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }
      
      try {
          await sendNotification({
              recipients: [user._id],
              sender: null,
              type: 'GENERAL',
              title: `Welcome Back, Admin!`,
              message: "Here's what's happening on the platform today.",
              data: { userId: user._id.toString() }
          });
      } catch (e) {
          console.error("Error sending admin login notification:", e);
      }

      const sessionToken = generateSessionToken();
      const accessToken = generateAccessToken(user._id, sessionToken);
      
      res.status(200).json({
          success: true,
          message: 'Admin login successful',
          data: { accessToken }
      });
  } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Google OAuth login
exports.googleLogin = async (req, res) => {
  const { idToken,role } = req.body;
  try {
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'No ID token provided' });
    }
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_IDS,
    });
    const payload = ticket.getPayload();
    const { email, name, picture, sub } = payload;

    let user = await User.findOne({ email });

    if (user) {
      if (user.phoneNumber && !user.googleId) {
        return res.status(400).json({
          success: false,
          message: 'This email is already registered with a phone number. Please use OTP login instead.',
          loginMethod: 'otp',
          phoneNumber: user.phoneNumber.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')
        });
      }
      if (!user.googleId) {
        user.googleId = sub;
        user.avatar = picture;
      }
    } else {
      user = new User({
        name,
        email,
        googleId: sub,
        avatar: picture,
        role: role || 'student',
        isVerified: !['event', 'instructor'].includes(role || 'student')
      });
    }

    const sessionToken = generateSessionToken();
    const accessToken = generateAccessToken(user._id, sessionToken);
    const refreshToken = generateRefreshToken(user._id);
    
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);
    
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
      return res.status(404).json({ success: false, message: 'User not found' });
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
    if (!name || (!email && !phoneNumber)) {
      return res.status(400).json({ success: false, message: 'Please provide name and either email or phone number' });
    }

    let existingUser = null;
    if (email) {
      existingUser = await User.findOne({ email });
    }
    if (!existingUser && phoneNumber) {
      existingUser = await User.findOne({ phoneNumber });
    }

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with that email or phone number' });
    }

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
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }
    
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }
    
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken || new Date(user.refreshTokenExpiry) < new Date()) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token or token expired' });
    }
    
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

// module.exports = {
//     signupWithPhone,
//     sendOtp,
//     verifyOtp,
//     adminLogin,
//     googleLogin,
//     getMe,
//     logout,
//     registerAdmin,
//     refreshToken,
// };
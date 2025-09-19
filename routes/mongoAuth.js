const express = require('express');
const authController = require('../controllers/auth');
const adminAuthController = require('../controllers/adminAuth');
const { protect } = require('../middleware/mongoAuth');

const router = express.Router();

// Phone + OTP Authentication routes
router.post('/signup', authController.signupWithPhone);
router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);

// Google OAuth login
router.post('/google-login', authController.googleLogin);

// Admin authentication routes
router.post('/register-admin', adminAuthController.registerAdmin);
router.post('/admin-login', adminAuthController.adminLogin);

// Regular login for instructors and students

// User profile routes
router.get('/me', protect, authController.getMe);

// Session management
router.post('/logout', protect, authController.logout);

// Token management routes
router.post('/refresh-token', authController.refreshToken);

module.exports = router;

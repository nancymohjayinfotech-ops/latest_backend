const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/mongoAuth');
const { 
  verifyPayment, 
  createPayment, 
  getPaymentHistory 
} = require('../controllers/Payment');

// Create payment record
router.post('/create', protect, authorize('student'), createPayment);

// Verify payment and enroll in course
router.post('/verify', protect, authorize('student'), verifyPayment);

// Get payment history
router.get('/history', protect, authorize('student'), getPaymentHistory);

module.exports = router;

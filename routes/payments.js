const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/mongoAuth');
const { 
  createOrder,
  verifyPayment, 
  handleWebhook,
  getPaymentStatus,
  initiateRefund,
  getPaymentHistory 
} = require('../controllers/Payment');

// Create Razorpay order based on cart contents
router.post('/create-order', protect, authorize('student'), createOrder);

// Verify payment and enroll in course
router.post('/verify', protect, authorize('student'), verifyPayment);

// Handle Razorpay webhooks (public endpoint)
router.post('/webhook', handleWebhook);

// Get payment status by order ID
router.get('/status/:orderId', protect, authorize('student'), getPaymentStatus);

// Initiate refund (admin/instructor only)
router.post('/refund', protect, authorize('admin', 'instructor'), initiateRefund);

// Get payment history
router.get('/history', protect, authorize('student'), getPaymentHistory);

module.exports = router;

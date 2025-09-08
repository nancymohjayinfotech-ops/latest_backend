const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/mongoAuth');
const { 
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
  getCartCount,
  checkCourseInCart,
  moveToWishlist
} = require('../controllers/Cart');

// Get user's cart
router.get('/', protect, authorize('student'), getCart);

// Get cart item count
router.get('/count', protect, authorize('student'), getCartCount);

// Check if course is in cart
router.get('/check/:courseId', protect, authorize('student'), checkCourseInCart);

// Add course to cart
router.post('/add', protect, authorize('student'), addToCart);

// Remove course from cart
router.delete('/remove/:courseId', protect, authorize('student'), removeFromCart);

// Clear entire cart
router.delete('/clear', protect, authorize('student'), clearCart);

// Move course to wishlist
router.post('/move-to-wishlist/:courseId', protect, authorize('student'), moveToWishlist);

module.exports = router;

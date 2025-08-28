const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  setCollege,
  addFavoriteCourse,
  removeFavoriteCourse,
  getFavoriteCourses,
  addToCart,
  removeFromCart,
  getCart,
  clearCart,
  getUserByRole,
  setUserInterests,
  getUserInterests,
  checkInterestsStatus
} = require('../controllers/User');
const { protect, authorize } = require('../middleware/mongoAuth');

// User profile routes
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/set-college', protect, setCollege); // New endpoint for setting college after Google sign-in

router.get('/getUserByRole/:role', protect, authorize('admin','instructor'), getUserByRole);

// Favorite courses routes
router.get('/favorites', protect, getFavoriteCourses);
router.post('/favorites/:courseId', protect, addFavoriteCourse);
router.delete('/favorites/:courseId', protect, removeFavoriteCourse);

// Cart routes
router.get('/cart', protect, getCart);
router.post('/cart/:courseId', protect, addToCart);
router.delete('/cart/:courseId', protect, removeFromCart);
router.delete('/cart', protect, clearCart);

// Interest selection routes
router.post('/interests', protect, setUserInterests);
router.get('/interests', protect, getUserInterests);
router.get('/interests/status', protect, checkInterestsStatus);

module.exports = router;

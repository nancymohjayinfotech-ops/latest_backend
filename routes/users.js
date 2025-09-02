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
  getUserByRolePaginated,
  setUserInterests,
  getUserInterests,
  checkInterestsStatus,
  createUser,
  getAllUsers,
  getUserById,
  updateUser
} = require('../controllers/User');
const { protect, authorize } = require('../middleware/mongoAuth');

// User profile routes
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/set-college', protect, setCollege); // New endpoint for setting college after Google sign-in

router.get('/getUserByRole/:role', protect, authorize('admin','instructor'), getUserByRole);
router.get('/getUserByRole/:role/paginated', protect, authorize('admin'), getUserByRolePaginated);

// Admin-only user management routes
router.post('/create', protect, authorize('admin'), createUser);
router.get('/all', protect, authorize('admin'), getAllUsers);
router.get('/:userId', protect, authorize('admin'), getUserById);
router.put('/update/:userId', protect, authorize('admin'), updateUser);

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

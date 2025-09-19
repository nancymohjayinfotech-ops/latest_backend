const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/Dashboard');
const { protect, authorize } = require('../middleware/mongoAuth');

// Dashboard route - restricted to admin and instructors
router.get('/stats', protect, authorize('admin'), getDashboardStats);

module.exports = router;

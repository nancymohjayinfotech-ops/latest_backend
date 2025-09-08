const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/mongoAuth');
const studentController = require('../controllers/Student');

router.get('/events', protect, authorize('student'), studentController.getAllEvents);
router.get('/events/:slug', protect, authorize('student'), studentController.getEventBySlug);

module.exports = router;
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/mongoAuth');
const { uploadMultiple } = require('../middleware/uploadMiddleware');
const { 
    createEvent, 
    getEventBySlug, 
    editEvent,
    getAllEvents,
    getEventById,
    enrollInEvent,
    getStudentEnrollments,
    manageEnrollment,
    getEventEnrollments,
    getEventDashboard
} = require('../controllers/Event');

// Set uploadType for event images
const setEventUploadType = (req, res, next) => {
    req.uploadType = 'event';
    // Only set req.body.uploadType if req.body exists
    if (req.body) {
        req.body.uploadType = 'event';
    }
    next();
};

// Public Routes
router.get('/slug/:slug', getEventBySlug);
router.get('/dashboard', getEventDashboard);

// Student Routes (Protected)
router.post('/:eventId/enroll', protect, authorize('student'), enrollInEvent);
router.get('/my-enrollments', protect, authorize('student'), getStudentEnrollments);

// Admin Routes (Protected)
router.post('/', protect, authorize('event'), setEventUploadType, uploadMultiple('images', 10), createEvent);
router.get('/', protect, authorize('event'), getAllEvents);
router.get('/:id', protect, authorize('event'), getEventById);
router.put('/:id', protect, authorize('event'), setEventUploadType, uploadMultiple('images', 10), editEvent);
router.get('/:eventId/enrollments', protect, authorize('event'), getEventEnrollments);
router.patch('/:eventId/enrollments/:enrollmentId', protect, authorize('event'), manageEnrollment);

module.exports = router;

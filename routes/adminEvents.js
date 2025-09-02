const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/mongoAuth');
const { uploadMultiple } = require('../middleware/uploadMiddleware');
const { 
    createEvent, 
    editEvent, 
    getAllEvents, 
    getEventById, 
    deleteEvent,
    getEventEnrollments,
    manageEnrollment,
    getEventDashboard
} = require('../controllers/Event');

const setEventUploadType = (req, res, next) => {
    req.uploadType = 'event';
    // Only set req.body.uploadType if req.body exists
    if (req.body) {
        req.body.uploadType = 'event';
    }
    next();
};
router.get('/dashboard', protect, authorize('admin'), getEventDashboard);
router.post('/', protect, authorize('admin'), setEventUploadType, uploadMultiple('images', 10), createEvent);
router.get('/', protect, authorize('admin'), getAllEvents);
router.get('/:id', protect, authorize('admin'), getEventById);
router.put('/:id', protect, authorize('admin'), setEventUploadType, uploadMultiple('images', 10), editEvent);
router.delete('/:id', protect, authorize('admin'), deleteEvent);

// Enrollment Management Routes
router.get('/:eventId/enrollments', protect, authorize('admin'), getEventEnrollments);
router.patch('/:eventId/enrollments/:enrollmentId', protect, authorize('admin'), manageEnrollment);

module.exports = router;

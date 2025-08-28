const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/mongoAuth');
const { uploadMultiple } = require('../middleware/uploadMiddleware');
const { createEvent, getEventBySlug } = require('../controllers/Event');

// Set uploadType for event images
const setEventUploadType = (req, res, next) => {
    req.uploadType = 'event';
    // Only set req.body.uploadType if req.body exists
    if (req.body) {
        req.body.uploadType = 'event';
    }
    next();
};
router.post('/', protect, authorize('admin', 'event'), setEventUploadType, uploadMultiple('images', 10), createEvent);
router.get('/:slug', getEventBySlug);
module.exports = router;

const express = require('express');
const router = express.Router();
const {
  createOffer,
  getOffers,
  getOffer,
  getOffersForCourse,
  updateOffer,
  deleteOffer,
  applyOffer,
  validateCoupon,
  getStudentOffers
} = require('../controllers/Offer');
const { protect, authorize } = require('../middleware/mongoAuth');

// Offer routes
router.route('/')
  .get(protect,getOffers)
  .post(protect, authorize('admin'), createOffer);

router.route('/:id')
  .get(getOffer)
  .put(protect, authorize('admin'), updateOffer)
  .delete(protect, authorize('admin'), deleteOffer);

// Course-specific offers
router.route('/course/:courseId')
  .get(getOffersForCourse);

// Apply offer to a course for a user
router.route('/apply')
  .post(protect, applyOffer);

// Validate coupon code
router.route('/validate-coupon')
  .post(validateCoupon);

// Student offers route
router.route('/student')
  .get(protect, authorize('student'), getStudentOffers);

module.exports = router;

const Offer = require('../models/Offer');
const Course = require('../models/Course');

// Create a new offer
const createOffer = async (req, res) => {
  try {
    // Map request fields to model fields
    const offerData = {
      title: req.body.title,
      code: req.body.couponCode, // Map couponCode to code
      description: req.body.description,
      discountType: req.body.discountPercentage ? 'percentage' : 'fixed', // Determine type based on which field is provided
      discountValue: req.body.discountPercentage || req.body.discountAmount, // Use either percentage or fixed amount
      startDate: new Date(req.body.validFrom), // Map validFrom to startDate
      endDate: new Date(req.body.validUntil), // Map validUntil to endDate
      isActive: req.body.active,
      usageLimit: parseInt(req.body.maxUses) || null, // Map maxUses to usageLimit
      usageCount: parseInt(req.body.currentUses) || 0,// Map currentUses to usageCount
      applicableCourses: req.body.courseId ? [req.body.courseId] : []
    };
    
    const offer = new Offer(offerData);
    await offer.save();
    
    return res.status(201).json({
      success: true,
      data: offer,
      message: 'Offer created successfully'
    });
  } catch (error) {
    console.error('Error creating offer:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating offer',
      error: error.message
    });
  }
};

// Get all offers
const getOffers = async (req, res) => {
  try {
    const offers = await Offer.find().sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      count: offers.length,
      data: offers
    });
  } catch (error) {
    console.error('Error getting offers:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting offers',
      error: error.message
    });
  }
};

// Get a single offer by ID
const getOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: offer
    });
  } catch (error) {
    console.error('Error getting offer:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting offer',
      error: error.message
    });
  }
};

// Get offers applicable to a specific course
const getOffersForCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    
    // Find offers that are either applicable to all courses (empty applicableCourses)
    // or specifically include this course
    const offers = await Offer.find({
      $or: [
        { applicableCourses: { $size: 0 } },
        { applicableCourses: courseId }
      ],
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    });
    
    return res.status(200).json({
      success: true,
      count: offers.length,
      data: offers
    });
  } catch (error) {
    console.error('Error getting offers for course:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting offers for course',
      error: error.message
    });
  }
};

// Update an offer
const updateOffer = async (req, res) => {
  try {
    const offer = await Offer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: offer,
      message: 'Offer updated successfully'
    });
  } catch (error) {
    console.error('Error updating offer:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating offer',
      error: error.message
    });
  }
};

// Delete an offer
const deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Offer deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting offer:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting offer',
      error: error.message
    });
  }
};

// Apply an offer to a course for a user
const applyOffer = async (req, res) => {
  try {
    const { code, courseId } = req.body;
    
    if (!code || !courseId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide offer code and course ID'
      });
    }
    
    // Find the offer by code
    const offer = await Offer.findOne({ code: code.toUpperCase() });
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Invalid offer code'
      });
    }
    
    // Check if offer is valid
    if (!offer.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'This offer has expired or is no longer valid'
      });
    }
    
    // Check if offer is applicable to this course
    if (offer.applicableCourses.length > 0 && !offer.applicableCourses.includes(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'This offer is not applicable to the selected course'
      });
    }
    
    // Get course price
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }
    
    // Check minimum purchase amount
    if (course.price < offer.minPurchaseAmount) {
      return res.status(400).json({
        success: false,
        message: `This offer requires a minimum purchase of ${offer.minPurchaseAmount}`
      });
    }
    
    // Apply discount
    const discountResult = offer.applyDiscount(course.price);
    
    // Increment usage count
    offer.usageCount += 1;
    await offer.save();
    
    return res.status(200).json({
      success: true,
      data: {
        ...discountResult,
        offerCode: offer.code,
        offerTitle: offer.title
      },
      message: 'Offer applied successfully'
    });
  } catch (error) {
    console.error('Error applying offer:', error);
    return res.status(500).json({
      success: false,
      message: 'Error applying offer',
      error: error.message
    });
  }
};

// Validate a coupon code
const validateCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a coupon code'
      });
    }
    
    // Find the offer by code
    const offer = await Offer.findOne({ code: code.toUpperCase() });
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }
    
    // Check if offer is valid
    const isValid = offer.isValid();
    
    return res.status(200).json({
      success: true,
      data: {
        isValid,
        offer: isValid ? offer : null,
        message: isValid ? 'Coupon is valid' : 'Coupon has expired or is no longer valid'
      }
    });
  } catch (error) {
    console.error('Error validating coupon:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating coupon',
      error: error.message
    });
  }
};

/**
 * Get offers for students with active/expired status
 * @route GET /api/offers/student
 * @access Private (Student only)
 */
const getStudentOffers = async (req, res) => {
  try {
    // Get current date for comparison
    const currentDate = new Date();
    
    // Find all active offers
    const offers = await Offer.find({ isActive: true });
    
    // Format offers with active/expired status
    const formattedOffers = offers.map(offer => {
      // Check if offer is active based on dates
      const isActive = 
        offer.startDate <= currentDate && 
        offer.endDate >= currentDate &&
        (!offer.usageLimit || offer.usageCount < offer.usageLimit);
      
      return {
        _id: offer._id,
        title: offer.title,
        code: offer.code,
        description: offer.description,
        discountType: offer.discountType,
        discountValue: offer.discountValue,
        startDate: offer.startDate,
        endDate: offer.endDate,
        status: isActive ? 'active' : 'expired',
        applicableCourses: offer.applicableCourses
      };
    });
    
    return res.status(200).json({
      success: true,
      message: 'Student offers retrieved successfully',
      data: {
        offers: formattedOffers
      }
    });
  } catch (error) {
    console.error('Error getting student offers:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting student offers',
      error: error.message
    });
  }
};

module.exports = {
  createOffer,
  getOffers,
  getOffer,
  getOffersForCourse,
  updateOffer,
  deleteOffer,
  applyOffer,
  validateCoupon,
  getStudentOffers
};

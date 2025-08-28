const Payment = require('../models/Payment');
const Course = require('../models/Course');
const User = require('../models/User');
const crypto = require('crypto');

/**
 * Verify payment and enroll student in course
 * @route POST /api/payments/verify
 * @access Private (Student)
 */
const verifyPayment = async (req, res) => {
  try {
    const { 
      razorpayPaymentId, 
      razorpayOrderId, 
      razorpaySignature, 
      courseId 
    } = req.body;
    
    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature || !courseId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment information'
      });
    }

    // Find the payment by orderId
    const payment = await Payment.findOne({ razorpayOrderId });
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Update payment with verification details
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;
    payment.status = 'paid';
    await payment.save();
    
    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }
    
    // Find the user
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user is already enrolled
    const isEnrolled = user.enrolledCourses && 
      user.enrolledCourses.some(enrollment => 
        enrollment.course && enrollment.course.toString() === courseId
      );
    
    if (isEnrolled) {
      return res.status(400).json({
        success: false,
        message: 'User is already enrolled in this course'
      });
    }
    
    // Add user to course's enrolledStudents
    if (!course.enrolledStudents.includes(userId)) {
      course.enrolledStudents.push(userId);
      await course.save();
    }
    
    // Add course to user's enrolledCourses with proper structure
    if (!user.enrolledCourses) {
      user.enrolledCourses = [];
    }
    
    // Create enrollment object with progress tracking
    const enrollmentExists = user.enrolledCourses.some(enrollment => 
      enrollment.course && enrollment.course.toString() === courseId
    );
    
    if (!enrollmentExists) {
      user.enrolledCourses.push({
        course: courseId,
        enrolledAt: new Date(),
        lastAccessed: new Date(),
        progress: {
          completedSections: [],
          completedVideos: [],
          totalTimeSpent: 0
        }
      });
    }
    
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'Payment verified and enrollment successful',
      data: {
        payment: {
          id: payment._id,
          status: payment.status
        },
        course: {
          id: course._id,
          title: course.title
        }
      }
    });
    
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying payment',
      error: error.message
    });
  }
};

/**
 * Create a new payment record
 * @route POST /api/payments/create
 * @access Private (Student)
 */
const createPayment = async (req, res) => {
  try {
    const { courseId, razorpayOrderId, amount } = req.body;
    
    if (!courseId || !razorpayOrderId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment information'
      });
    }
    
    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }
    
    // Create payment record
    const payment = new Payment({
      user: req.user.id,
      course: courseId,
      amount,
      razorpayOrderId,
      status: 'created'
    });
    
    await payment.save();
    
    return res.status(201).json({
      success: true,
      message: 'Payment record created successfully',
      data: {
        payment: {
          id: payment._id,
          razorpayOrderId,
          amount,
          status: payment.status
        }
      }
    });
    
  } catch (error) {
    console.error('Error creating payment record:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating payment record',
      error: error.message
    });
  }
};

/**
 * Get payment history for a user
 * @route GET /api/payments/history
 * @access Private (Student)
 */
const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const payments = await Payment.find({ user: userId })
      .populate('course', 'title slug price')
      .sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      message: 'Payment history retrieved successfully',
      data: {
        payments
      }
    });
    
  } catch (error) {
    console.error('Error getting payment history:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting payment history',
      error: error.message
    });
  }
};

module.exports = {
  verifyPayment,
  createPayment,
  getPaymentHistory
};

const Payment = require('../models/Payment');
const Course = require('../models/Course');
const User = require('../models/User');
const Cart = require('../models/Cart');
const crypto = require('crypto');
const Razorpay = require('razorpay');
require('dotenv').config();

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's cart
    const cart = await Cart.findOne({ user: userId }).populate('items.course');
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty. Please add courses to cart before creating order.'
      });
    }

    // Check if user is already enrolled in any of the courses
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const enrolledCourseIds = user.enrolledCourses ? 
      user.enrolledCourses.map(enrollment => enrollment.course.toString()) : [];

    const conflictingCourses = cart.items.filter(item => 
      enrolledCourseIds.includes(item.course._id.toString())
    );

    if (conflictingCourses.length > 0) {
      const conflictingTitles = conflictingCourses.map(item => item.course.title);
      return res.status(400).json({
        success: false,
        message: `You are already enrolled in: ${conflictingTitles.join(', ')}`
      });
    }

    // Generate unique receipt
    const receipt = `cart_${userId}_${Date.now()}`;

    // Create Razorpay order
    const orderOptions = {
      amount: Math.round(cart.totalAmount * 100), // Amount in paise
      currency: 'INR',
      receipt: receipt,
      notes: {
        userId: userId,
        cartId: cart._id.toString(),
        courseCount: cart.totalCourses,
        courseIds: cart.items.map(item => item.course._id.toString()).join(','),
        isCartPayment: true
      }
    };

    const razorpayOrder = await razorpay.orders.create(orderOptions);

    // Create payment record for cart
    const payment = new Payment({
      user: userId,
      course: cart.items[0].course._id, // Primary course for reference
      amount: cart.totalAmount,
      currency: 'INR',
      razorpayOrderId: razorpayOrder.id,
      receipt: receipt,
      status: 'created',
      notes: {
        ...orderOptions.notes,
        courses: cart.items.map(item => ({
          courseId: item.course._id,
          title: item.course.title,
          price: item.course.price
        }))
      }
    });

    await payment.save();

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        cart: {
          totalAmount: cart.totalAmount,
          totalCourses: cart.totalCourses,
          courses: cart.items.map(item => ({
            id: item.course._id,
            title: item.course.title,
            price: item.course.price
          }))
        }
      }
    });

  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating payment order',
      error: error.message
    });
  }
};

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
      razorpaySignature
    } = req.body;
    
    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment information'
      });
    }

    // Find the payment by orderId
    const payment = await Payment.findOne({ razorpayOrderId }).populate('course');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Verify Razorpay signature
    const body = razorpayOrderId + "|" + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      // Update payment status to failed
      payment.status = 'failed';
      payment.failureReason = 'Invalid signature';
      await payment.save();

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed - Invalid signature'
      });
    }

    // Fetch payment details from Razorpay to get additional info
    try {
      const razorpayPayment = await razorpay.payments.fetch(razorpayPaymentId);
      
      // Update payment with verification details
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = razorpaySignature;
      payment.status = 'paid';
      payment.paymentMethod = razorpayPayment.method;
      payment.webhookData = razorpayPayment;
      await payment.save();
    } catch (fetchError) {
      console.error('Error fetching payment details:', fetchError);
      // Still proceed with enrollment if signature is valid
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = razorpaySignature;
      payment.status = 'paid';
      await payment.save();
    }

    // Get user from payment record
    const userId = payment.user;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // All payments are now cart-based, so handle cart payment enrollment
    const courseIds = payment.notes.courseIds.split(',');
    let enrolledCourses = [];
    
    for (const courseId of courseIds) {
      const course = await Course.findById(courseId);
      if (!course) continue;

      // Check if user is already enrolled
      const isEnrolled = user.enrolledCourses && 
        user.enrolledCourses.some(enrollment => 
          enrollment.course && enrollment.course.toString() === courseId
        );
      
      if (isEnrolled) continue;

      // Add user to course's enrolledStudents
      if (!course.enrolledStudents.includes(userId)) {
        course.enrolledStudents.push(userId);
        await course.save();
      }

      // Add course to user's enrolledCourses
      if (!user.enrolledCourses) {
        user.enrolledCourses = [];
      }

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

      enrolledCourses.push({
        id: course._id,
        title: course.title
      });
    }

    // Clear user's cart after successful payment
    await Cart.findOneAndUpdate(
      { user: userId },
      { $set: { items: [] } }
    );
    
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'Payment verified and enrollment successful',
      data: {
        payment: {
          id: payment._id,
          status: payment.status,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod
        },
        courses: enrolledCourses
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

const handleWebhook = async (req, res) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookBody = JSON.stringify(req.body);
    
    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(webhookBody)
      .digest('hex');

    if (webhookSignature !== expectedSignature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    const event = req.body.event;
    const paymentEntity = req.body.payload.payment.entity;

    // Find payment by razorpay payment ID or order ID
    let payment = await Payment.findOne({
      $or: [
        { razorpayPaymentId: paymentEntity.id },
        { razorpayOrderId: paymentEntity.order_id }
      ]
    });

    if (!payment) {
      console.log('Payment not found for webhook:', paymentEntity.id);
      return res.status(200).json({ success: true });
    }

    // Update payment based on event type
    switch (event) {
      case 'payment.captured':
        payment.status = 'paid';
        payment.razorpayPaymentId = paymentEntity.id;
        payment.paymentMethod = paymentEntity.method;
        payment.webhookData = paymentEntity;
        break;
        
      case 'payment.failed':
        payment.status = 'failed';
        payment.failureReason = paymentEntity.error_description || 'Payment failed';
        payment.webhookData = paymentEntity;
        break;
        
      case 'payment.authorized':
        payment.status = 'attempted';
        payment.razorpayPaymentId = paymentEntity.id;
        payment.webhookData = paymentEntity;
        break;
        
      default:
        console.log('Unhandled webhook event:', event);
    }

    await payment.save();

    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing webhook',
      error: error.message
    });
  }
};

const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const payment = await Payment.findOne({ razorpayOrderId: orderId })
      .populate('course', 'title slug price')
      .populate('user', 'name email');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if the payment belongs to the requesting user
    if (payment.user._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment status retrieved successfully',
      data: {
        payment: {
          id: payment._id,
          orderId: payment.razorpayOrderId,
          paymentId: payment.razorpayPaymentId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          paymentMethod: payment.paymentMethod,
          createdAt: payment.createdAt,
          course: payment.course
        }
      }
    });

  } catch (error) {
    console.error('Error getting payment status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting payment status',
      error: error.message
    });
  }
};

const initiateRefund = async (req, res) => {
  try {
    const { paymentId, amount, reason } = req.body;
    
    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required'
      });
    }

    const payment = await Payment.findById(paymentId).populate('course');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Only paid payments can be refunded'
      });
    }

    // Calculate refund amount (default to full amount if not specified)
    const refundAmount = amount || payment.amount;
    
    if (refundAmount > payment.amount) {
      return res.status(400).json({
        success: false,
        message: 'Refund amount cannot exceed payment amount'
      });
    }

    // Create refund with Razorpay
    const refundOptions = {
      amount: Math.round(refundAmount * 100), // Amount in paise
      notes: {
        reason: reason || 'Refund requested',
        refundedBy: req.user.id
      }
    };

    const razorpayRefund = await razorpay.payments.refund(payment.razorpayPaymentId, refundOptions);

    // Update payment record
    payment.status = 'refunded';
    payment.refundId = razorpayRefund.id;
    payment.refundAmount = refundAmount;
    payment.refundStatus = 'processed';
    payment.notes.refundReason = reason;
    
    await payment.save();

    return res.status(200).json({
      success: true,
      message: 'Refund initiated successfully',
      data: {
        refund: {
          id: razorpayRefund.id,
          amount: refundAmount,
          status: razorpayRefund.status,
          paymentId: payment._id
        }
      }
    });

  } catch (error) {
    console.error('Error initiating refund:', error);
    return res.status(500).json({
      success: false,
      message: 'Error initiating refund',
      error: error.message
    });
  }
};


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
  createOrder,
  verifyPayment,
  handleWebhook,
  getPaymentStatus,
  initiateRefund,
  getPaymentHistory
};

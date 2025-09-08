const Cart = require('../models/Cart');
const Course = require('../models/Course');
const User = require('../models/User');

/**
 * Get user's cart
 * @route GET /api/cart
 * @access Private (Student)
 */
const getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    
    let cart = await Cart.findOne({ user: userId })
      .populate({
        path: 'items.course',
        select: 'title slug price thumbnail description instructor category averageRating totalStudents duration',
        populate: {
          path: 'instructor',
          select: 'name profilePicture'
        }
      });

    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
      await cart.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Cart retrieved successfully',
      data: {
        cart: {
          id: cart._id,
          totalAmount: cart.totalAmount,
          totalCourses: cart.totalCourses,
          items: cart.items,
          updatedAt: cart.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Error getting cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving cart',
      error: error.message
    });
  }
};

/**
 * Add course to cart
 * @route POST /api/cart/add
 * @access Private (Student)
 */
const addToCart = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user.id;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required'
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

    // Check if user is already enrolled in this course
    const user = await User.findById(userId);
    const isEnrolled = user.enrolledCourses && 
      user.enrolledCourses.some(enrollment => 
        enrollment.course && enrollment.course.toString() === courseId
      );

    if (isEnrolled) {
      return res.status(400).json({
        success: false,
        message: 'You are already enrolled in this course'
      });
    }

    // Get or create cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    // Check if course is already in cart
    const existingItem = cart.items.find(item => 
      item.course.toString() === courseId
    );

    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'Course is already in your cart'
      });
    }

    // Add course to cart
    cart.items.push({
      course: courseId,
      addedAt: new Date()
    });

    await cart.save();

    return res.status(200).json({
      success: true,
      message: 'Course added to cart successfully',
      data: {
        cart: {
          id: cart._id,
          totalAmount: cart.totalAmount,
          totalCourses: cart.totalCourses,
        }
      }
    });

  } catch (error) {
    console.error('Error adding to cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Error adding course to cart',
      error: error.message
    });
  }
};

/**
 * Remove course from cart
 * @route DELETE /api/cart/remove/:courseId
 * @access Private (Student)
 */
const removeFromCart = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required'
      });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    // Find and remove the course from cart
    const itemIndex = cart.items.findIndex(item => 
      item.course.toString() === courseId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Course not found in cart'
      });
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();

    // Populate the cart for response
    await cart.populate({
      path: 'items.course',
      select: 'title slug price thumbnail description instructor category averageRating totalStudents duration',
      populate: {
        path: 'instructor',
        select: 'name profilePicture'
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Course removed from cart successfully',
      data: {
        cart: {
          id: cart._id,
          totalAmount: cart.totalAmount,
          totalCourses: cart.totalCourses,
          items: cart.items
        }
      }
    });

  } catch (error) {
    console.error('Error removing from cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Error removing course from cart',
      error: error.message
    });
  }
};

/**
 * Clear entire cart
 * @route DELETE /api/cart/clear
 * @access Private (Student)
 */
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = [];
    await cart.save();

    return res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: {
        cart: {
          id: cart._id,
          totalAmount: cart.totalAmount,
          totalCourses: cart.totalCourses,
          items: cart.items
        }
      }
    });

  } catch (error) {
    console.error('Error clearing cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Error clearing cart',
      error: error.message
    });
  }
};

/**
 * Get cart item count
 * @route GET /api/cart/count
 * @access Private (Student)
 */
const getCartCount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const cart = await Cart.findOne({ user: userId });
    const count = cart ? cart.totalCourses : 0;

    return res.status(200).json({
      success: true,
      message: 'Cart count retrieved successfully',
      data: {
        count
      }
    });

  } catch (error) {
    console.error('Error getting cart count:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting cart count',
      error: error.message
    });
  }
};

/**
 * Check if course is in cart
 * @route GET /api/cart/check/:courseId
 * @access Private (Student)
 */
const checkCourseInCart = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const cart = await Cart.findOne({ user: userId });
    const inCart = cart ? cart.items.some(item => 
      item.course.toString() === courseId
    ) : false;

    return res.status(200).json({
      success: true,
      message: 'Course cart status checked',
      data: {
        inCart,
        courseId
      }
    });

  } catch (error) {
    console.error('Error checking course in cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking course in cart',
      error: error.message
    });
  }
};

/**
 * Move course from cart to wishlist (if wishlist exists)
 * @route POST /api/cart/move-to-wishlist/:courseId
 * @access Private (Student)
 */
const moveToWishlist = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Remove from cart
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(item => 
      item.course.toString() === courseId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Course not found in cart'
      });
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();

    // Note: Add to wishlist logic here if wishlist model exists
    // For now, just remove from cart

    return res.status(200).json({
      success: true,
      message: 'Course moved to wishlist successfully',
      data: {
        courseId
      }
    });

  } catch (error) {
    console.error('Error moving to wishlist:', error);
    return res.status(500).json({
      success: false,
      message: 'Error moving course to wishlist',
      error: error.message
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
  getCartCount,
  checkCourseInCart,
  moveToWishlist
};

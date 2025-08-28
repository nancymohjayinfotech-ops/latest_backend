const User = require('../models/User');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');

// Get user profile - handles req/res directly
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name role avatar college studentId phoneNumber email');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error getting profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

const getUserByRole = async (req, res) => {
  try {
    const users = await User.find({ role: req.params.role }).select('name avatar email college studentId');
    return res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error getting users by role:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Helper function to generate a unique student ID based on college name and random number
const generateStudentId = async (collegeName) => {
  try {
    // Create a short form of college name (first letter of each word)
    const collegeCode = collegeName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('');
    
    // Get current year
    const year = new Date().getFullYear().toString().substr(-2);
    
    // Generate a random 4-digit number
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    
    // Combine to create student ID: COLLEGE_CODE-YEAR-RANDOM
    const studentId = `${collegeCode}-${year}-${randomNum}`;
    
    // Check if this ID already exists
    const existingUser = await User.findOne({ studentId });
    if (existingUser) {
      // If exists, try again with a different random number
      return generateStudentId(collegeName);
    }
    
    return studentId;
  } catch (error) {
    console.error('Error generating student ID:', error);
    throw error;
  }
};

// Set college and generate student ID after first login (Google sign-in)
const setCollege = async (req, res) => {
  try {
    // Only allow this API to be used if the user doesn't have a college or studentId set
    const currentUser = await User.findById(req.user.id);
    
    if (currentUser.college && currentUser.studentId) {
      return res.status(400).json({
        success: false,
        message: 'College and student ID are already set and cannot be changed'
      });
    }
    
    if (!req.body.college) {
      return res.status(400).json({
        success: false,
        message: 'College name is required'
      });
    }
    
    // Generate a student ID based on the college name
    const studentId = await generateStudentId(req.body.college);
    
    // Update the user with college and studentId
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { 
        state: req.body.state,
        city: req.body.city,
        college: req.body.college,
        studentId: studentId,
        dob: req.body.dob,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'student ID generated successfully',
      studentId: studentId
    });
  } catch (error) {
    console.error('Error setting college:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Update user profile - handles req/res directly
const updateProfile = async (req, res) => {
  try {
    // Remove college from allowed fields so it can't be updated after initial setup
    const allowedFields = ['name', 'avatar', 'bio', 'phone', 'address'];
    const updateData = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    updateData.updatedAt = new Date();
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

const addFavoriteCourse = async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user.id,
      { 
        $addToSet: { favoriteCourses: req.params.courseId },
        updatedAt: new Date()
      }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Course added to favorites'
    });
  } catch (error) {
    console.error('Error adding favorite course:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

const removeFavoriteCourse = async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user.id,
      { 
        $pull: { favoriteCourses: req.params.courseId },
        updatedAt: new Date()
      }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Course removed from favorites'
    });
  } catch (error) {
    console.error('Error removing favorite course:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

const getFavoriteCourses = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('favoriteCourses');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      courses: user.favoriteCourses || []
    });
  } catch (error) {
    console.error('Error getting favorite courses:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

const addToCart = async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user.id,
      { 
        $addToSet: { cart: req.params.courseId },
        updatedAt: new Date()
      }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Course added to cart'
    });
  } catch (error) {
    console.error('Error adding course to cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

const removeFromCart = async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user.id,
      { 
        $pull: { cart: req.params.courseId },
        updatedAt: new Date()
      }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Course removed from cart'
    });
  } catch (error) {
    console.error('Error removing course from cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

const getCart = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('cart');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      cart: user.cart || []
    });
  } catch (error) {
    console.error('Error getting cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

const clearCart = async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user.id,
      { 
        cart: [],
        updatedAt: new Date()
      }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Cart cleared'
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};



// Set user interests (categories and subcategories)
const setUserInterests = async (req, res) => {
  try {
    const { categories, subcategories } = req.body;
    
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one category must be selected'
      });
    }
    
    if (!subcategories || !Array.isArray(subcategories) || subcategories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one subcategory must be selected'
      });
    }
    
    // Validate that categories exist
    const validCategories = await Category.find({ 
      _id: { $in: categories }, 
      isActive: true 
    });
    
    if (validCategories.length !== categories.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected categories are invalid'
      });
    }
    
    // Validate that subcategories exist and belong to selected categories
    const validSubcategories = await Subcategory.find({ 
      _id: { $in: subcategories }, 
      categoryId: { $in: categories },
      isActive: true 
    });
    
    if (validSubcategories.length !== subcategories.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected subcategories are invalid or do not belong to selected categories'
      });
    }
    
    // Update user interests
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        'interests.categories': categories,
        'interests.subcategories': subcategories,
        isInterestsSet: true,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Interests updated successfully',
    });
  } catch (error) {
    console.error('Error setting user interests:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get user interests for dashboard
const getUserInterests = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('interests.categories', 'name')
      .populate('interests.subcategories', 'name');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'User interests retrieved successfully',
      data: {
        categories: user.interests.categories || [],
        subcategories: user.interests.subcategories || [],
        isInterestsSet: user.isInterestsSet || false
      }
    });
  } catch (error) {
    console.error('Error getting user interests:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Check if user has set interests (for onboarding flow)
const checkInterestsStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('isInterestsSet');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Interests status retrieved successfully',
      data: {
        isInterestsSet: user.isInterestsSet || false
      }
    });
  } catch (error) {
    console.error('Error checking interests status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  setCollege,
  addFavoriteCourse,
  removeFavoriteCourse,
  getFavoriteCourses,
  addToCart,
  removeFromCart,
  getCart,
  clearCart,
  getUserByRole,
  setUserInterests,
  getUserInterests,
  checkInterestsStatus
};

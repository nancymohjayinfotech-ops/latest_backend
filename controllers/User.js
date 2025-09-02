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

const getUserByRolePaginated = async (req, res) => {
  try {
     const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        // Calculate skip value for pagination
        const skip = (page - 1) * limit;
        
        // Get total count for pagination metadata
        const totalCount = await User.countDocuments({ role: req.params.role });
        
        // Calculate pagination metadata
        const totalPages = Math.ceil(totalCount / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;
        
    const users = await User.find({ role: req.params.role }).skip(skip).limit(limit);
    return res.status(200).json({
      success: true,
      users,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage,
        hasPrevPage
      }
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

// Create new user (Admin only)
const createUser = async (req, res) => {
  try {
    const { name, email, phoneNumber, password, role, college, state, city, dob, bio, address } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }
    
    if (!role || !['admin', 'instructor', 'student', 'event'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role is required (admin, instructor, student, event)'
      });
    }
    
    // Check if user with email or phone already exists
    if (email) {
      const existingUserByEmail = await User.findOne({ email });
      if (existingUserByEmail) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }
    }
    
    if (phoneNumber) {
      const existingUserByPhone = await User.findOne({ phoneNumber });
      if (existingUserByPhone) {
        return res.status(400).json({
          success: false,
          message: 'User with this phone number already exists'
        });
      }
    }
    
    // Create user data object
    const userData = {
      name,
      role,
      email: email || '',
      phoneNumber: phoneNumber || '',
      password: password || '',
      bio: bio || '',
      dob: dob || '',
      state: state || '',
      city: city || '',
      college: college || '',
      address: address || '',
      isActive: true
    };
    
    // Generate student ID if role is student and college is provided
    if (role === 'student' && college) {
      userData.studentId = await generateStudentId(college);
    }
    
    // Create the user
    const user = new User(userData);
    await user.save();
    
    // Return user without sensitive information
    const userResponse = await User.findById(user._id).select('-password -otpHash -sessionToken -refreshToken');
    
    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get all users (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const role = req.query.role;
    const isActive = req.query.isActive;
    const search = req.query.search;
    
    // Calculate skip value for pagination
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    // Add search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
        { college: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get total count for pagination metadata
    const totalCount = await User.countDocuments(filter);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    // Get users with selected fields (excluding sensitive data)
    const users = await User.find(filter)
      .select('-password -otpHash -sessionToken -refreshToken -otpExpiry -otpAttempts -otpAttemptsExpiry -refreshTokenExpiry')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      users,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    console.error('Error getting all users:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};



const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('-password -otpHash -sessionToken -refreshToken');
    
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
    console.error('Error getting user by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Update user (Admin only)
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phoneNumber, role, college, state, city, dob, bio, address, isActive } = req.body;
    
    // Check if user exists
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Validate role if provided
    if (role && !['admin', 'instructor', 'student', 'event'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role is required (admin, instructor, student, event)'
      });
    }
    
    // Check for duplicate email or phone (excluding current user)
    if (email && email !== existingUser.email) {
      const duplicateEmail = await User.findOne({ email, _id: { $ne: userId } });
      if (duplicateEmail) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }
    }
    
    if (phoneNumber && phoneNumber !== existingUser.phoneNumber) {
      const duplicatePhone = await User.findOne({ phoneNumber, _id: { $ne: userId } });
      if (duplicatePhone) {
        return res.status(400).json({
          success: false,
          message: 'User with this phone number already exists'
        });
      }
    }
    
    // Prepare update data
    const updateData = {
      updatedAt: new Date()
    };
    
    // Only update fields that are provided
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (role !== undefined) updateData.role = role;
    if (college !== undefined) updateData.college = college;
    if (state !== undefined) updateData.state = state;
    if (city !== undefined) updateData.city = city;
    if (dob !== undefined) updateData.dob = dob;
    if (bio !== undefined) updateData.bio = bio;
    if (address !== undefined) updateData.address = address;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Generate new student ID if role changed to student and college is provided
    if (role === 'student' && college && existingUser.role !== 'student') {
      updateData.studentId = await generateStudentId(college);
    }
    
    // Update the user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -otpHash -sessionToken -refreshToken');
    
    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
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
  checkInterestsStatus,
  getUserByRolePaginated,
  createUser,
  getAllUsers,
  getUserById,
  updateUser
};

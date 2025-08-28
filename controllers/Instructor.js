const Course = require('../models/Course');
const User = require('../models/User');
const getInstructorStats = async (req, res) => {
  try {
    const instructorId = req.user.id;
    
    // Get all courses by this instructor
    const courses = await Course.find({ instructor: instructorId });
    
    // Calculate total enrolled students (unique)
    const enrolledStudentIds = new Set();
    let totalEnrolledStudents = 0;
    
    courses.forEach(course => {
      if (course.enrolledStudents && course.enrolledStudents.length > 0) {
        course.enrolledStudents.forEach(studentId => {
          enrolledStudentIds.add(studentId.toString());
        });
      }
    });
    
    totalEnrolledStudents = enrolledStudentIds.size;
    
    // Calculate average rating across all courses
    let totalRatings = 0;
    let ratingCount = 0;
    
    courses.forEach(course => {
      if (course.ratings && course.ratings.length > 0) {
        totalRatings += course.averageRating * course.ratings.length;
        ratingCount += course.ratings.length;
      }
    });
    
    const averageRating = ratingCount > 0 ? (totalRatings / ratingCount).toFixed(1) : 0;
    
    // Get course count by status
    const publishedCourses = courses.filter(course => course.published).length;
    const draftCourses = courses.length - publishedCourses;
    
    return res.status(200).json({
      success: true,
      message: 'Instructor statistics retrieved successfully',
      data: {
        totalCourses: courses.length,
        publishedCourses,
        draftCourses,
        totalEnrolledStudents,
        averageRating,
        ratingCount
      }
    });
  } catch (error) {
    console.error('Error getting instructor stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting instructor statistics',
      error: error.message
    });
  }
};

const getInstructorRatings = async (req, res) => {
  try {
    const instructorId = req.user.id;
    
    // Get all courses by this instructor
    const courses = await Course.find({ instructor: instructorId })
      .select('title slug ratings averageRating');
    
    // Process ratings data
    const courseRatings = courses.map(course => {
      // Calculate rating distribution
      const distribution = {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0
      };
      
      if (course.ratings && course.ratings.length > 0) {
        course.ratings.forEach(rating => {
          if (distribution[rating.rating] !== undefined) {
            distribution[rating.rating]++;
          }
        });
      }
      
      return {
        courseId: course._id,
        title: course.title,
        slug: course.slug,
        averageRating: course.averageRating || 0,
        totalRatings: course.ratings ? course.ratings.length : 0,
        distribution
      };
    });
    
    // Calculate overall instructor rating
    let totalRatings = 0;
    let ratingCount = 0;
    
    courses.forEach(course => {
      if (course.ratings && course.ratings.length > 0) {
        totalRatings += course.averageRating * course.ratings.length;
        ratingCount += course.ratings.length;
      }
    });
    
    const overallRating = ratingCount > 0 ? (totalRatings / ratingCount).toFixed(1) : 0;
    
    return res.status(200).json({
      success: true,
      message: 'Instructor ratings retrieved successfully',
      data: {
        overallRating,
        totalRatings: ratingCount,
        courseRatings
      }
    });
  } catch (error) {
    console.error('Error getting instructor ratings:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting instructor ratings',
      error: error.message
    });
  }
};

const getInstructorReviews = async (req, res) => {
  try {
    const instructorId = req.user.id;
    
    // Extract pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get all courses by this instructor
    const courses = await Course.find({ instructor: instructorId })
      .select('title slug ratings')
      .populate({
        path: 'ratings.user',
        select: 'name avatar'
      });
    
    // Extract all reviews with course information
    let allReviews = [];
    
    courses.forEach(course => {
      if (course.ratings && course.ratings.length > 0) {
        const courseReviews = course.ratings
          .filter(rating => rating.review && rating.review.trim() !== '')
          .map(rating => ({
            reviewId: rating._id,
            courseId: course._id,
            courseTitle: course.title,
            courseSlug: course.slug,
            rating: rating.rating,
            review: rating.review,
            user: rating.user,
            createdAt: rating.createdAt
          }));
        
        allReviews = [...allReviews, ...courseReviews];
      }
    });
    
    // Sort reviews by date (newest first)
    allReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Apply pagination
    const paginatedReviews = allReviews.slice(skip, skip + limit);
    
    // Calculate pagination metadata
    const totalReviews = allReviews.length;
    const totalPages = Math.ceil(totalReviews / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return res.status(200).json({
      success: true,
      message: 'Instructor reviews retrieved successfully',
      data: {
        reviews: paginatedReviews,
        pagination: {
          currentPage: page,
          totalPages,
          totalReviews,
          limit,
          hasNextPage,
          hasPrevPage
        }
      }
    });
  } catch (error) {
    console.error('Error getting instructor reviews:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting instructor reviews',
      error: error.message
    });
  }
};

const getCourseFeedback = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const courseId = req.query.courseId;
    
    // If courseId is provided, get feedback for that specific course
    if (courseId) {
      const course = await Course.findOne({
        _id: courseId,
        instructor: instructorId
      }).populate({
        path: 'ratings.user',
        select: 'name avatar'
      });
      
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found or you do not have permission to access it'
        });
      }
      
      const feedback = course.ratings || [];
      
      return res.status(200).json({
        success: true,
        message: 'Course feedback retrieved successfully',
        data: {
          courseId: course._id,
          courseTitle: course.title,
          feedback
        }
      });
    }
    
    // Otherwise, get feedback for all courses
    const courses = await Course.find({ instructor: instructorId })
      .select('title slug ratings')
      .populate({
        path: 'ratings.user',
        select: 'name avatar'
      });
    
    const courseFeedback = courses.map(course => ({
      courseId: course._id,
      courseTitle: course.title,
      courseSlug: course.slug,
      averageRating: course.averageRating || 0,
      totalRatings: course.ratings ? course.ratings.length : 0,
      feedback: course.ratings || []
    }));
    
    return res.status(200).json({
      success: true,
      message: 'Course feedback retrieved successfully',
      data: {
        courses: courseFeedback
      }
    });
  } catch (error) {
    console.error('Error getting course feedback:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting course feedback',
      error: error.message
    });
  }
};

const updateInstructorProfile = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { name, bio, avatar } = req.body;
    
    // Validate input
    if (!name && !bio && !avatar) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one field to update'
      });
    }
    
    // Build update object with only provided fields
    const updateData = {};
    if (name) updateData.name = name;
    if (bio) updateData.bio = bio;
    if (avatar) updateData.avatar = avatar;
    
    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      instructorId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -refreshToken -sessionToken -otpHash');
    
    if (!updatedUser) {
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
    console.error('Error updating instructor profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating instructor profile',
      error: error.message
    });
  }
};

const getInstructorNotifications = async (req, res) => {
  try {
    // This is a placeholder for the notification system
    // In a real implementation, you would query a notifications collection
    
    return res.status(200).json({
      success: true,
      message: 'Instructor notifications retrieved successfully',
      data: {
        notifications: []
      }
    });
  } catch (error) {
    console.error('Error getting instructor notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting instructor notifications',
      error: error.message
    });
  }
};

const getCoursesWithEnrolledStudents = async (req, res) => {
  try {
    const instructorId = req.user.id;
    
    // Extract pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const totalCount = await Course.countDocuments({ instructor: instructorId });
    
    // Get courses with enrolled students count
    const courses = await Course.find({ instructor: instructorId })
      .select('title slug description thumbnail price published enrolledStudents averageRating ratings category subcategory createdAt')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Format courses with enrolled student count
    const formattedCourses = courses.map(course => {
      const enrolledStudentsCount = course.enrolledStudents ? course.enrolledStudents.length : 0;
      
      return {
        _id: course._id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        thumbnail: course.thumbnail,
        price: course.price,
        published: course.published,
        enrolledStudentsCount,
        averageRating: course.averageRating || 0,
        ratingsCount: course.ratings ? course.ratings.length : 0,
        category: course.category,
        subcategory: course.subcategory,
        createdAt: course.createdAt
      };
    });
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return res.status(200).json({
      success: true,
      message: 'Instructor courses retrieved successfully',
      data: {
        courses: formattedCourses,
        pagination: {
          currentPage: page,
          totalPages,
          totalCourses: totalCount,
          limit,
          hasNextPage,
          hasPrevPage
        }
      }
    });
  } catch (error) {
    console.error('Error getting instructor courses with students:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting instructor courses',
      error: error.message
    });
  }
};

module.exports = {
  getInstructorStats,
  getInstructorRatings,
  getInstructorReviews,
  getCourseFeedback,
  updateInstructorProfile,
  getInstructorNotifications,
  getCoursesWithEnrolledStudents
};

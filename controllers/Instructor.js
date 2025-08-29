const Course = require('../models/Course');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Assessment = require('../models/Assessment');
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

const getInstructorReviews = async (req, res) => {
  try {
    const instructorId = req.user.id;
    
    // Get instructor details
    const instructor = await User.findById(instructorId)
      .select('name bio avatar');
    
    // Extract pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get all courses by this instructor
    const courses = await Course.find({ instructor: instructorId })
      .select('title slug ratings averageRating')
      .populate({
        path: 'ratings.user',
        select: 'name avatar'
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
    
    const overallRating = ratingCount > 0 ? parseFloat((totalRatings / ratingCount).toFixed(1)) : 0;
    
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
        instructor: {
          name: instructor.name,
          bio: instructor.bio,
          avatar: instructor.avatar,
          averageRating: overallRating,
          totalRatings: ratingCount
        },
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

const getAllEnrolledStudents = async (req, res) => {
  try {
    const instructorId = req.user.id;
    
    // Extract pagination and filter parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const isActive = req.query.isActive;
    const searchQuery = req.query.search;
    
    // Build populate match conditions
    const populateMatch = {};
    if (isActive !== undefined) {
      populateMatch.isActive = isActive === 'true';
    }
    
    // Get all courses by this instructor
    const courses = await Course.find({ instructor: instructorId })
      .select('_id title slug enrolledStudents')
      .populate({
        path: 'enrolledStudents',
        select: 'name email phone avatar isActive studentId',
        match: populateMatch
      });
    
    // Extract all unique students from all courses
    const studentMap = new Map();
    const studentCourses = new Map();
    
    courses.forEach(course => {
      if (course.enrolledStudents && course.enrolledStudents.length > 0) {
        course.enrolledStudents.forEach(student => {
          const studentId = student._id.toString();
          
          // Add student to map if not already present
          if (!studentMap.has(studentId)) {
            studentMap.set(studentId, {
              _id: student._id,
              name: student.name,
              email: student.email,
              phone: student.phone || '',
              avatar: student.avatar,
              isActive: student.isActive,
              studentId: student.studentId,
            });
            studentCourses.set(studentId, []);
          }
          
          // Add course to student's courses
          studentCourses.get(studentId).push({
            courseId: course._id,
            title: course.title,
            slug: course.slug
          });
        });
      }
    });
    
    // Convert map to array and add course information
    let allStudents = Array.from(studentMap.values()).map(student => {
      const studentId = student._id.toString();
      return {
        ...student,
        courses: studentCourses.get(studentId) || []
      };
    });
    
    // Apply search filter if provided
    if (searchQuery && searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      allStudents = allStudents.filter(student => {
        const nameMatch = student.name && student.name.toLowerCase().includes(query);
        const studentIdMatch = student.studentId && student.studentId.toLowerCase().includes(query);
        const emailMatch = student.email && student.email.toLowerCase().includes(query);
        
        return nameMatch || studentIdMatch || emailMatch;
      });
    }
    
    // Sort students by enrollment date (newest first)
    allStudents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Apply pagination
    const paginatedStudents = allStudents.slice(skip, skip + limit);
    
    // Calculate pagination metadata
    const totalStudents = allStudents.length;
    const totalPages = Math.ceil(totalStudents / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return res.status(200).json({
      success: true,
      message: 'Enrolled students retrieved successfully',
      data: {
        students: paginatedStudents,
        pagination: {
          currentPage: page,
          totalPages,
          totalStudents,
          limit,
          hasNextPage,
          hasPrevPage
        },
        filters: {
          isActive: isActive,
          searchQuery: searchQuery
        }
      }
    });
  } catch (error) {
    console.error('Error getting enrolled students:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting enrolled students',
      error: error.message
    });
  }
};

const updateInstructorSlots = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { availabilitySlots } = req.body;

    // Validate that user is an instructor
    if (req.user.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        message: 'Only instructors can update availability slots'
      });
    }

    // Validate slots format
    if (!Array.isArray(availabilitySlots)) {
      return res.status(400).json({
        success: false,
        message: 'Availability slots must be an array'
      });
    }

    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

    for (const slot of availabilitySlots) {
      if (!slot.startTime || !slot.endTime || !slot.dayOfWeek) {
        return res.status(400).json({
          success: false,
          message: 'Each slot must have startTime, endTime, and dayOfWeek'
        });
      }

      if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
        return res.status(400).json({
          success: false,
          message: 'Time format must be HH:MM (24-hour format)'
        });
      }

      if (!validDays.includes(slot.dayOfWeek.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid day of week'
        });
      }

      const [startHour, startMin] = slot.startTime.split(':').map(Number);
      const [endHour, endMin] = slot.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (startMinutes >= endMinutes) {
        return res.status(400).json({
          success: false,
          message: 'Start time must be before end time'
        });
      }
    }

    // Update instructor availability slots
    const updatedInstructor = await User.findByIdAndUpdate(
      instructorId,
      { availabilitySlots },
      { new: true, runValidators: true }
    ).select('name email availabilitySlots');

    return res.status(200).json({
      success: true,
      message: 'Availability slots updated successfully',
      data: {
        instructor: updatedInstructor
      }
    });

  } catch (error) {
    console.error('Error updating instructor slots:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating availability slots',
      error: error.message
    });
  }
};

const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationPreferences } = req.body;

    if (!notificationPreferences || typeof notificationPreferences !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Notification preferences must be provided as an object'
      });
    }

    const validPreferences = ['session', 'messages','feedBack','newEnrollments','reviews'];
    const updateData = {};

    for (const [key, value] of Object.entries(notificationPreferences)) {
      if (!validPreferences.includes(key)) {
        return res.status(400).json({
          success: false,
          message: `Invalid notification preference: ${key}`
        });
      }

      if (typeof value !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: `Notification preference ${key} must be a boolean value`
        });
      }

      updateData[`notificationPreferences.${key}`] = value;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('name email role notificationPreferences');

    return res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: {
        user: updatedUser
      }
    });

  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating notification preferences',
      error: error.message
    });
  }
};

const getInstructorSlots = async (req, res) => {
  try {
    const instructorId = req.user.id;

    if (req.user.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        message: 'Only instructors can view availability slots'
      });
    }

    const instructor = await User.findById(instructorId)
      .select('name email availabilitySlots');

    return res.status(200).json({
      success: true,
      message: 'Availability slots retrieved successfully',
      data: {
        instructor
      }
    });

  } catch (error) {
    console.error('Error getting instructor slots:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving availability slots',
      error: error.message
    });
  }
};

const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .select('name email role notificationPreferences');

    return res.status(200).json({
      success: true,
      message: 'Notification preferences retrieved successfully',
      data: {
        user
      }
    });

  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving notification preferences',
      error: error.message
    });
  }
};

const deleteInstructorSlot = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { slotId } = req.params;

    if (req.user.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        message: 'Only instructors can delete availability slots'
      });
    }

    // Find the instructor
    const instructor = await User.findById(instructorId);
    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }

    // Check if instructor has availability slots
    if (!instructor.availabilitySlots || instructor.availabilitySlots.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No availability slots found'
      });
    }

    // Find the slot index by its ID
    const slotIndex = instructor.availabilitySlots.findIndex(
      slot => slot._id.toString() === slotId
    );

    if (slotIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Slot not found'
      });
    }

    // Remove the slot from the array
    instructor.availabilitySlots.splice(slotIndex, 1);

    // Save the updated instructor
    await instructor.save();

    return res.status(200).json({
      success: true,
      message: 'Availability slot deleted successfully',
      data: {
        instructor: {
          name: instructor.name,
          email: instructor.email,
          availabilitySlots: instructor.availabilitySlots
        }
      }
    });

  } catch (error) {
    console.error('Error deleting instructor slot:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting availability slot',
      error: error.message
    });
  }
};

const getInstructorQuizzes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get quizzes created by the instructor
    const quizzes = await Quiz.find({ createdBy: req.user.id })
      .populate('course', 'title slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('title questions timeLimit active createdAt course');

    // Get total count for pagination
    const totalQuizzes = await Quiz.countDocuments({ createdBy: req.user.id });

    res.status(200).json({
      success: true,
      quizzes,
      count: quizzes.length,
      totalPages: Math.ceil(totalQuizzes / limit),
      currentPage: page,
      
    });
  } catch (error) {
    console.error('Error fetching instructor quizzes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch instructor quizzes',
      error: error.message
    });
  }
};

const getInstructorAssessments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get assessments created by the instructor
    const assessments = await Assessment.find({ createdBy: req.user.id })
      .populate('course', 'title slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('title description dueDate totalPoints active createdAt course');

    // Get total count for pagination
    const totalAssessments = await Assessment.countDocuments({ createdBy: req.user.id });

    res.status(200).json({
      success: true,
      assessments,
      count: assessments.length,
      totalPages: Math.ceil(totalAssessments / limit),
      currentPage: page,
      
    });
  } catch (error) {
    console.error('Error fetching instructor assessments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch instructor assessments',
      error: error.message
    });
  }
};

module.exports = {
  getInstructorStats,
  getInstructorReviews,
  getCourseFeedback,
  updateInstructorProfile,
  getInstructorNotifications,
  getCoursesWithEnrolledStudents,
  getAllEnrolledStudents,
  updateInstructorSlots,
  updateNotificationPreferences,
  getInstructorSlots,
  getNotificationPreferences,
  deleteInstructorSlot,
  getInstructorQuizzes,
  getInstructorAssessments
};

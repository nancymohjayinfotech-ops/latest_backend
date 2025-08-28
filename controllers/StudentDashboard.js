const User = require('../models/User');
const Course = require('../models/Course');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const AssessmentResult = require('../models/AssessmentResult');

/**
 * Get enrolled courses with progress for the current student
 * @route GET /api/student/enrolled-courses
 * @access Private (Student only)
 */
const getEnrolledCoursesWithProgress = async (req, res) => {
  try {
    // Extract pagination parameters from query
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'enrolledAt';
    const order = req.query.order === 'asc' ? 1 : -1;
    
    // Calculate skip value for pagination
    const skip = (page - 1) * limit;
    
    // Find the current user and populate enrolled courses
    const user = await User.findById(req.user.id)
      .populate({
        path: 'enrolledCourses.course',
        select: 'title slug thumbnail instructor category subcategory sections videos',
        populate: [
          { path: 'instructor', select: 'name avatar' },
          { path: 'category', select: 'name' },
          { path: 'subcategory', select: 'name' }
        ]
      })
      .select('enrolledCourses');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get total count for pagination
    const totalCount = user.enrolledCourses.length;
    
    // Sort enrolled courses based on the sort parameter
    const sortedEnrolledCourses = user.enrolledCourses.sort((a, b) => {
      if (sort === 'enrolledAt') {
        return order === 1 
          ? new Date(a.enrolledAt) - new Date(b.enrolledAt)
          : new Date(b.enrolledAt) - new Date(a.enrolledAt);
      }
      return 0;
    });
    
    // Apply pagination
    const paginatedEnrolledCourses = sortedEnrolledCourses.slice(skip, skip + limit);
    
    // Format the response with progress information
    const courses = paginatedEnrolledCourses.map(enrollment => {
      const course = enrollment.course;
      
      if (!course) {
        return null; // Skip if course is null (might have been deleted)
      }
      
      // Calculate progress
      const totalSections = course.sections ? course.sections.length : 0;
      const totalVideos = course.videos ? course.videos.length : 0;
      
      const completedSections = enrollment.progress 
        ? enrollment.progress.completedSections.length 
        : 0;
      
      const completedVideos = enrollment.progress 
        ? enrollment.progress.completedVideos.length 
        : 0;
      
      // Calculate percentage
      const percentage = totalVideos > 0 
        ? Math.round((completedVideos / totalVideos) * 100) 
        : 0;
      
      return {
        _id: course._id,
        title: course.title,
        slug: course.slug,
        thumbnail: course.thumbnail,
        instructor: course.instructor,
        category: course.category,
        subcategory: course.subcategory,
        progress: {
          percentage,
          completedSections,
          totalSections,
          completedVideos,
          totalVideos,
          lastAccessed: enrollment.lastAccessed || enrollment.enrolledAt
        },
        enrolledAt: enrollment.enrolledAt
      };
    }).filter(course => course !== null); // Filter out null courses
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return res.status(200).json({
      success: true,
      message: 'Enrolled courses retrieved successfully',
      data: {
        courses,
        pagination: {
          totalCount,
          totalPages,
          currentPage: page,
          pageSize: limit,
          hasNextPage,
          hasPrevPage
        }
      }
    });
  } catch (error) {
    console.error('Error getting enrolled courses:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Get detailed progress for a specific course
 * @route GET /api/student/courses/:courseId/progress
 * @access Private (Student only)
 */
const getCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Find the user and the specific enrolled course
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Find the enrollment for the specified course
    const enrollment = user.enrolledCourses.find(
      enrollment => enrollment.course.toString() === courseId
    );
    
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'You are not enrolled in this course'
      });
    }
    
    // Get the course details
    const course = await Course.findById(courseId)
      .select('title sections');
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }
    
    // Calculate total videos from all sections
    let totalVideos = 0;
    course.sections.forEach(section => {
      if (section.videos && section.videos.length > 0) {
        totalVideos += section.videos.length;
      }
    });
    
    const completedVideos = enrollment.progress 
      ? enrollment.progress.completedVideos.length 
      : 0;
    
    const overallProgress = totalVideos > 0 
      ? Math.round((completedVideos / totalVideos) * 100) 
      : 0;
    
    // Format sections with progress information
    const sections = course.sections.map(section => {
      // Get videos for this section (they're already in section.videos)
      const sectionVideos = section.videos || [];
      
      // Calculate section progress
      const sectionVideosCompleted = sectionVideos.filter(video => 
        enrollment.progress && 
        enrollment.progress.completedVideos.includes(video._id)
      ).length;
      
      const sectionProgress = sectionVideos.length > 0 
        ? Math.round((sectionVideosCompleted / sectionVideos.length) * 100) 
        : 0;
      
      // Format videos with watched status
      const formattedVideos = sectionVideos.map(video => {
        const isWatched = enrollment.progress && 
          enrollment.progress.completedVideos.includes(video._id);
        
        const watchedDuration = isWatched ? (video.durationSeconds || 0) : 0;
        
        return {
          videoId: video._id,
          title: video.title,
          duration: video.durationSeconds || 0,
          watched: isWatched,
          watchedDuration,
          lastWatched: isWatched ? enrollment.lastAccessed : null
        };
      });
      
      return {
        sectionId: section._id,
        title: section.title,
        progress: sectionProgress,
        videos: formattedVideos
      };
    });
    
    return res.status(200).json({
      success: true,
      message: 'Course progress retrieved successfully',
      data: {
        courseId,
        title: course.title,
        overallProgress,
        sections,
        lastAccessed: enrollment.lastAccessed || enrollment.enrolledAt,
        enrolledAt: enrollment.enrolledAt
      }
    });
  } catch (error) {
    console.error('Error getting course progress:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Get student dashboard statistics
 * @route GET /api/student/dashboard/stats
 * @access Private (Student only)
 */
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user with enrolled courses
    const user = await User.findById(userId)
      .populate({
        path: 'enrolledCourses.course',
        select: 'title rating averageRating totalRatings'
      })
      .select('enrolledCourses');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate total enrolled courses
    const totalCourses = user.enrolledCourses.length;

    // Calculate total learning hours
    let totalLearningHours = 0;
    user.enrolledCourses.forEach(enrollment => {
      if (enrollment.progress && enrollment.progress.totalTimeSpent) {
        totalLearningHours += enrollment.progress.totalTimeSpent;
      }
    });
    
    // Convert seconds to hours
    const learningHours = Math.round(totalLearningHours / 3600);

    // Calculate average rating from completed courses
    let totalRating = 0;
    let ratedCoursesCount = 0;
    
    user.enrolledCourses.forEach(enrollment => {
      if (enrollment.course && enrollment.course.averageRating) {
        totalRating += enrollment.course.averageRating;
        ratedCoursesCount++;
      }
    });

    const averageRating = ratedCoursesCount > 0 
      ? Math.round((totalRating / ratedCoursesCount) * 10) / 10 
      : 0;

    // Calculate completion rate
    let totalProgress = 0;
    let coursesWithProgress = 0;
    
    user.enrolledCourses.forEach(enrollment => {
      if (enrollment.progress) {
        // Calculate course completion percentage
        const completedVideos = enrollment.progress.completedVideos.length;
        // We'll need to get total videos from course, for now use a simple calculation
        totalProgress += completedVideos; // This will be refined when we have total video counts
        coursesWithProgress++;
      }
    });

    const completionRate = coursesWithProgress > 0 
      ? Math.round((totalProgress / (coursesWithProgress * 10)) * 100) // Rough estimate
      : 0;

    return res.status(200).json({
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      data: {
        totalCourses,
        learningHours,
        averageRating,
        completionRate,
        enrolledCoursesCount: totalCourses
      }
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

module.exports = {
  getEnrolledCoursesWithProgress,
  getCourseProgress,
  getDashboardStats,
};

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/mongoAuth');

// Import controllers
const courseController = require('../controllers/Course');
const groupController = require('../controllers/Group');
const instructorController = require('../controllers/Instructor');

// Middleware to ensure only instructors can access these routes
router.use(protect, authorize('instructor'));

/**
 * @route   GET /api/instructor/courses
 * @desc    Get all courses created by the instructor
 * @access  Private (Instructor only)
 */
router.get('/courses', (req, res) => {
  // Add instructor filter to query params
  req.query.instructor = req.user.id;
  courseController.getAllCourses(req, res);
});

/**
 * @route   GET /api/instructor/all-courses
 * @desc    Get all courses in the system (not just instructor's own)
 * @access  Private (Instructor only)
 */
router.get('/all-courses', courseController.getAllCourses);

/**
 * @route   GET /api/instructor/courses/with-students
 * @desc    Get instructor courses with enrolled student count
 * @access  Private (Instructor only)
 */
router.get('/courses/with-students', instructorController.getCoursesWithEnrolledStudents);

/**
 * @route   GET /api/instructor/courses/stats
 * @desc    Get instructor course statistics (count, enrolled students)
 * @access  Private (Instructor only)
 */
router.get('/courses/stats', instructorController.getInstructorStats);

/**
 * @route   GET /api/instructor/ratings
 * @desc    Get instructor ratings based on course ratings
 * @access  Private (Instructor only)
 */
router.get('/ratings', instructorController.getInstructorRatings);

/**
 * @route   GET /api/instructor/reviews
 * @desc    Get reviews for instructor's courses
 * @access  Private (Instructor only)
 */
router.get('/reviews', instructorController.getInstructorReviews);

/**
 * @route   GET /api/instructor/feedback
 * @desc    Get feedback for instructor's courses
 * @access  Private (Instructor only)
 */
router.get('/feedback', instructorController.getCourseFeedback);

/**
 * @route   GET /api/instructor/notifications
 * @desc    Get instructor notifications
 * @access  Private (Instructor only)
 */
router.get('/notifications', instructorController.getInstructorNotifications);

/**
 * @route   PUT /api/instructor/profile
 * @desc    Update instructor profile (name, bio, avatar)
 * @access  Private (Instructor only)
 */
router.put('/profile', instructorController.updateInstructorProfile);

/**
 * @route   GET /api/instructor/groups
 * @desc    Get all groups for instructor
 * @access  Private (Instructor only)
 */
router.get('/groups', groupController.getGroupsForUser);

/**
 * @route   GET /api/instructor/groups/:groupId
 * @desc    Get group details with members and messages
 * @access  Private (Instructor only)
 */
router.get('/groups/:groupId', groupController.getGroupWithMessages);

module.exports = router;

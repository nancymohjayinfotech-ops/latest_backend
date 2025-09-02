const express = require('express');
const router = express.Router();
const {
  createCourse,
  getCourseById,
  getCourseBySlug,
  getAllCourses,
  deleteCourse,
  enrollStudent,
  addRating,
  getAllCoursesWithPagination,
  getFeaturedCourses,
  getPopularCourses,
  getCoursesBySubcategory,
  getRecommendedCourses
} = require('../controllers/Course');

const { 
  getEnrolledCoursesWithProgress,
  getCourseProgress,
  updateCourseProgress,
  getDashboardStats
} = require('../controllers/StudentDashboard');

const { protect, authorize } = require('../middleware/mongoAuth');

// Course routes
router
  .route('/')
  .get(getAllCourses)
  .post(protect, authorize('admin'), createCourse);

router
  .route('/id/:id')
  .get(getCourseById)
  .delete(protect, authorize('admin'), deleteCourse);

router.route('/paginated')
.get(getAllCoursesWithPagination);

router.route('/slug/:slug')
  .get(protect, getCourseBySlug);

// Enrollment route
router.route('/:id/enroll').post(protect, authorize('student'), enrollStudent);

// Rating route
router.route('/:id/ratings').post(protect, authorize('student'), addRating);

// Featured and popular courses routes
router.route('/featured')
  .get(protect, authorize('student'), getFeaturedCourses);

router.route('/popular')
  .get(protect, authorize('student'), getPopularCourses);

// Recommended courses route
router.route('/recommended')
  .get(protect, authorize('student'), getRecommendedCourses);

// Courses by subcategory route
router.route('/subcategory/:subcategoryId')
  .get(getCoursesBySubcategory);

// Student dashboard stats integrated with courses
router.route('/student/dashboard/stats')
  .get(protect, authorize('student'), getDashboardStats);

// Student dashboard routes
router.route('/student/enrolled')
  .get(protect, authorize('student'), getEnrolledCoursesWithProgress);

router.route('/student/:courseId/progress')
  .get(protect, authorize('student'), getCourseProgress)
  .put(protect, authorize('student'), updateCourseProgress);

module.exports = router;

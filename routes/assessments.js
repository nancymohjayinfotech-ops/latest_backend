const express = require('express');
const router = express.Router();
const assessmentController = require('../controllers/Assessment');
const { protect, authorize } = require('../middleware/mongoAuth');

// Instructor routes
router.post('/create', protect, authorize('instructor', 'admin'), assessmentController.createAssessment);
router.put('/:assessmentId', protect, authorize('instructor', 'admin'), assessmentController.updateAssessment);
router.delete('/:assessmentId', protect, authorize('instructor', 'admin'), assessmentController.deleteAssessment);
router.post('/grade/:resultId', protect, authorize('instructor', 'admin'), assessmentController.gradeAssessment);
router.get('/course/:courseId/results', protect, authorize('instructor', 'admin'), assessmentController.getCourseAssessmentResults);

// Student and instructor routes
router.get('/course/:courseId', protect, authorize('student', 'instructor', 'admin'), assessmentController.getAssessmentsByCourse);
router.get('/:assessmentId', protect, authorize('student', 'instructor', 'admin'), assessmentController.getAssessmentById);

// Student-specific routes
router.post('/:assessmentId/submit', protect, authorize('student'), assessmentController.submitAssessment);
router.get('/results/student', protect, authorize('student'), assessmentController.getStudentAssessmentResults);

module.exports = router;

const express = require('express');
const router = express.Router();
const quizController = require('../controllers/Quiz');
const { protect, authorize } = require('../middleware/mongoAuth');


// Instructor routes
router.post('/create', protect, authorize('instructor', 'admin'), quizController.createQuiz);
router.put('/:quizId', protect, authorize('instructor', 'admin'), quizController.updateQuiz);
router.delete('/:quizId', protect, authorize('instructor', 'admin'), quizController.deleteQuiz);
router.get('/course/:courseId/results', protect, authorize('instructor', 'admin'), quizController.getCourseQuizResults);

// Student and instructor routes
router.get('/course/:courseId', protect, authorize('student', 'instructor', 'admin'), quizController.getQuizzesByCourse);
router.get('/:quizId', protect, authorize('student', 'instructor', 'admin'), quizController.getQuizById);
router.get('/:quizId/leaderboard', protect, authorize('student', 'instructor', 'admin'), quizController.getQuizLeaderboard);

// Student-specific routes
router.post('/:quizId/submit', protect, authorize('student'), quizController.submitQuiz);
router.get('/results/student', protect, authorize('student'), quizController.getStudentQuizResults);

module.exports = router;

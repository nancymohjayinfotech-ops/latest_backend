const Quiz = require('../models/Quiz');
const Course = require('../models/Course');
const QuizResult = require('../models/QuizResult');
const mongoose = require('mongoose');

// Create a new quiz
exports.createQuiz = async (req, res) => {
  try {
    const { title, course, questions, timeLimit } = req.body;

    // Validate course exists
    const courseExists = await Course.findById(course);
    if (!courseExists) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Validate questions format
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Quiz must have at least one question'
      });
    }

    // Validate each question has required fields
    for (const q of questions) {
      if (!q.question || !q.options || !Array.isArray(q.options) || q.options.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Each question must have a question text and at least 2 options'
        });
      }

      if (q.rightAnswer === undefined || q.rightAnswer < 0 || q.rightAnswer >= q.options.length) {
        return res.status(400).json({
          success: false,
          message: 'Each question must have a valid right answer index'
        });
      }
    }

    const quiz = new Quiz({
      title,
      course,
      questions,
      timeLimit: timeLimit || 30,
      createdBy: req.user.id
    });

    await quiz.save();

    res.status(201).json({
      success: true,
      message: 'Quiz created successfully',
      quiz
    });
  } catch (error) {
    console.error('Error creating quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create quiz',
      error: error.message
    });
  }
};

// Get all quizzes for a course
exports.getQuizzesByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const quizzes = await Quiz.find({ 
      course: courseId,
      isActive: true 
    }).select('title timeLimit createdAt');

    res.status(200).json({
      success: true,
      count: quizzes.length,
      quizzes
    });
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quizzes',
      error: error.message
    });
  }
};

// Get a single quiz by ID
exports.getQuizById = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findById(quizId);
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // If user is a student, don't send the right answers
    if (req.user.role === 'student') {
      const quizForStudent = {
        _id: quiz._id,
        title: quiz.title,
        course: quiz.course,
        timeLimit: quiz.timeLimit,
        questions: quiz.questions.map(q => ({
          _id: q._id,
          question: q.question,
          options: q.options
          // rightAnswer is intentionally omitted
        }))
      };
      
      return res.status(200).json({
        success: true,
        quiz: quizForStudent
      });
    }

    // For instructors, send the complete quiz
    res.status(200).json({
      success: true,
      quiz
    });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quiz',
      error: error.message
    });
  }
};

// Update a quiz
exports.updateQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { title, questions, timeLimit, active } = req.body;

    const quiz = await Quiz.findById(quizId);
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Check if user is the creator or admin
    if (quiz.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this quiz'
      });
    }

    // Update fields if provided
    if (title) quiz.title = title;
    if (timeLimit) quiz.timeLimit = timeLimit;
    if (active !== undefined) quiz.isActive = active;

    // Update questions if provided
    if (questions && Array.isArray(questions) && questions.length > 0) {
      // Validate each question has required fields
      for (const q of questions) {
        if (!q.question || !q.options || !Array.isArray(q.options) || q.options.length < 2) {
          return res.status(400).json({
            success: false,
            message: 'Each question must have a question text and at least 2 options'
          });
        }

        if (q.rightAnswer === undefined || q.rightAnswer < 0 || q.rightAnswer >= q.options.length) {
          return res.status(400).json({
            success: false,
            message: 'Each question must have a valid right answer index'
          });
        }
      }
      
      quiz.questions = questions;
    }

    await quiz.save();

    res.status(200).json({
      success: true,
      message: 'Quiz updated successfully',
      quiz
    });
  } catch (error) {
    console.error('Error updating quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quiz',
      error: error.message
    });
  }
};

// Delete a quiz
exports.deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findById(quizId);
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Check if user is the creator or admin
    if (quiz.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this quiz'
      });
    }

    // Check if there are any quiz results
    const resultsCount = await QuizResult.countDocuments({ quiz: quizId });
    
    if (resultsCount > 0) {
      // Instead of deleting, just mark as inactive
      quiz.isActive = false;
      await quiz.save();
      
      return res.status(200).json({
        success: true,
        message: 'Quiz has been deactivated because it has submissions'
      });
    }

    // If no results, delete the quiz
    await Quiz.findByIdAndDelete(quizId);

    res.status(200).json({
      success: true,
      message: 'Quiz deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete quiz',
      error: error.message
    });
  }
};

// Submit a quiz (for students)
exports.submitQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { answers, startTime, endTime } = req.body;
    
    // Validate quiz exists
    const quiz = await Quiz.findById(quizId);
    if (!quiz || !quiz.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found or inactive'
      });
    }

    // Validate answers format
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: 'Answers must be provided as an array'
      });
    }

    // Check if student has already submitted this quiz
    const existingResult = await QuizResult.findOne({
      student: req.user.id,
      quiz: quizId
    });

    if (existingResult) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted this quiz'
      });
    }

    // Process answers and calculate score
    const processedAnswers = [];
    let score = 0;

    for (const answer of answers) {
      const { questionIndex, selectedOption } = answer;
      
      // Validate question index
      if (questionIndex < 0 || questionIndex >= quiz.questions.length) {
        return res.status(400).json({
          success: false,
          message: `Invalid question index: ${questionIndex}`
        });
      }

      const question = quiz.questions[questionIndex];
      const isCorrect = selectedOption === question.rightAnswer;
      
      if (isCorrect) {
        score++;
      }

      processedAnswers.push({
        questionIndex,
        selectedOption,
        isCorrect
      });
    }

    // Create quiz result
    const quizResult = new QuizResult({
      student: req.user.id,
      quiz: quizId,
      course: quiz.course,
      answers: processedAnswers,
      startTime: startTime || new Date(),
      endTime: endTime || new Date(),
      score,
      totalQuestions: quiz.questions.length
    });

    await quizResult.save();

    res.status(201).json({
      success: true,
      message: 'Quiz submitted successfully',
      result: {
        score,
        totalQuestions: quiz.questions.length,
        percentageScore: Math.round((score / quiz.questions.length) * 100),
        passed: quizResult.passed
      }
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit quiz',
      error: error.message
    });
  }
};

// Get quiz results for a student
exports.getStudentQuizResults = async (req, res) => {
  try {
    const results = await QuizResult.find({ 
      student: req.user.id 
    })
    .populate('quiz', 'title')
    .populate('course', 'title')
    .select('score totalQuestions passed createdAt');

    res.status(200).json({
      success: true,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Error fetching quiz results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quiz results',
      error: error.message
    });
  }
};

// Get quiz results for a course (for instructors)
exports.getCourseQuizResults = async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Verify the instructor teaches this course
    const course = await Course.findOne({
      _id: courseId,
      instructor: req.user.id
    });
    
    if (!course && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view results for this course'
      });
    }

    const results = await QuizResult.find({ course: courseId })
      .populate('student', 'name email')
      .populate('quiz', 'title')
      .select('score totalQuestions passed createdAt');

    res.status(200).json({
      success: true,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Error fetching course quiz results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course quiz results',
      error: error.message
    });
  }
};

// Get quiz leaderboard
exports.getQuizLeaderboard = async (req, res) => {
  try {
    const { quizId } = req.params;
    
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    const leaderboard = await QuizResult.find({ quiz: quizId })
      .populate('student', 'name')
      .select('score totalQuestions passed')
      .sort({ score: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      leaderboard
    });
  } catch (error) {
    console.error('Error fetching quiz leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quiz leaderboard',
      error: error.message
    });
  }
};

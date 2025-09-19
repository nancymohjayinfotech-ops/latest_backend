const Assessment = require('../models/Assessment');
const Course = require('../models/Course');
const AssessmentResult = require('../models/AssessmentResult');
const mongoose = require('mongoose');

// Create a new assessment
exports.createAssessment = async (req, res) => {
  try {
    const { title, description, course, dueDate, totalPoints } = req.body;

    // Validate course exists
    const courseExists = await Course.findById(course);
    if (!courseExists) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Validate required fields
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required'
      });
    }

    const assessment = new Assessment({
      title,
      description,
      course,
      dueDate: dueDate || null,
      totalPoints: totalPoints || 100,
      createdBy: req.user.id
    });

    await assessment.save();

    res.status(201).json({
      success: true,
      message: 'Assessment created successfully',
      assessment
    });
  } catch (error) {
    console.error('Error creating assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create assessment',
      error: error.message
    });
  }
};

// Get all assessments for a course
exports.getAssessmentsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const assessments = await Assessment.find({ 
      course: courseId,
      isActive: true 
    }).select('title description dueDate totalPoints createdAt');

    res.status(200).json({
      success: true,
      count: assessments.length,
      assessments
    });
  } catch (error) {
    console.error('Error fetching assessments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assessments',
      error: error.message
    });
  }
};

// Get a single assessment by ID
exports.getAssessmentById = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const assessment = await Assessment.findById(assessmentId);
    
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    res.status(200).json({
      success: true,
      assessment
    });
  } catch (error) {
    console.error('Error fetching assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assessment',
      error: error.message
    });
  }
};

// Update an assessment
exports.updateAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { title, description, dueDate, totalPoints, active } = req.body;

    const assessment = await Assessment.findById(assessmentId);
    
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    // Check if user is the creator or admin
    if (assessment.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this assessment'
      });
    }

    // Update fields if provided
    if (title) assessment.title = title;
    if (description) assessment.description = description;
    if (dueDate !== undefined) assessment.dueDate = dueDate;
    if (totalPoints) assessment.totalPoints = totalPoints;
    if (active !== undefined) assessment.isActive = active;

    await assessment.save();

    res.status(200).json({
      success: true,
      message: 'Assessment updated successfully',
      assessment
    });
  } catch (error) {
    console.error('Error updating assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update assessment',
      error: error.message
    });
  }
};

// Delete an assessment
exports.deleteAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const assessment = await Assessment.findById(assessmentId);
    
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    // Check if user is the creator or admin
    if (assessment.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this assessment'
      });
    }

    // Check if there are any assessment results
    const resultsCount = await AssessmentResult.countDocuments({ assessment: assessmentId });
    
    if (resultsCount > 0) {
      // Instead of deleting, just mark as inactive
      assessment.isActive = false;
      await assessment.save();
      
      return res.status(200).json({
        success: true,
        message: 'Assessment has been deactivated because it has submissions'
      });
    }

    // If no results, delete the assessment
    await Assessment.findByIdAndDelete(assessmentId);

    res.status(200).json({
      success: true,
      message: 'Assessment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete assessment',
      error: error.message
    });
  }
};

// Submit an assessment (for students)
exports.submitAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { text, fileUrl, fileName, fileType } = req.body;
    
    // Validate assessment exists
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment || !assessment.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found or inactive'
      });
    }

    // Check if due date has passed
    if (assessment.dueDate && new Date() > new Date(assessment.dueDate)) {
      // Allow submission but mark as late
      const submission = {
        text: text || '',
        fileUrl: fileUrl || '',
        fileName: fileName || '',
        fileType: fileType || ''
      };

      const assessmentResult = new AssessmentResult({
        student: req.user.id,
        assessment: assessmentId,
        course: assessment.course,
        submission,
        status: 'late'
      });

      await assessmentResult.save();

      return res.status(201).json({
        success: true,
        message: 'Assessment submitted successfully but marked as late',
        result: assessmentResult
      });
    }

    // Check if student has already submitted this assessment
    const existingResult = await AssessmentResult.findOne({
      student: req.user.id,
      assessment: assessmentId
    });

    if (existingResult) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted this assessment'
      });
    }

    // Create submission
    const submission = {
      text: text || '',
      fileUrl: fileUrl || '',
      fileName: fileName || '',
      fileType: fileType || ''
    };

    // Validate that at least one submission field is provided
    if (!text && !fileUrl) {
      return res.status(400).json({
        success: false,
        message: 'Assessment submission must include either text or a file'
      });
    }

    const assessmentResult = new AssessmentResult({
      student: req.user.id,
      assessment: assessmentId,
      course: assessment.course,
      submission,
      status: 'submitted'
    });

    await assessmentResult.save();

    res.status(201).json({
      success: true,
      message: 'Assessment submitted successfully',
      result: assessmentResult
    });
  } catch (error) {
    console.error('Error submitting assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit assessment',
      error: error.message
    });
  }
};

// Grade an assessment submission (for instructors)
exports.gradeAssessment = async (req, res) => {
  try {
    const { resultId } = req.params;
    const { score, feedback } = req.body;

    const result = await AssessmentResult.findById(resultId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Assessment result not found'
      });
    }

    // Verify the instructor teaches this course
    const course = await Course.findOne({
      _id: result.course,
      instructor: req.user.id
    });
    
    if (!course && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to grade this assessment'
      });
    }

    // Validate score
    const assessment = await Assessment.findById(result.assessment);
    if (score < 0 || score > assessment.totalPoints) {
      return res.status(400).json({
        success: false,
        message: `Score must be between 0 and ${assessment.totalPoints}`
      });
    }

    // Update result
    result.score = score;
    result.feedback = feedback || '';
    result.status = 'graded';
    result.gradedBy = req.user.id;
    result.gradedAt = new Date();

    await result.save();

    res.status(200).json({
      success: true,
      message: 'Assessment graded successfully',
      result
    });
  } catch (error) {
    console.error('Error grading assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to grade assessment',
      error: error.message
    });
  }
};

// Get assessment results for a student
exports.getStudentAssessmentResults = async (req, res) => {
  try {
    const results = await AssessmentResult.find({ 
      student: req.user.id 
    })
    .populate('assessment', 'title totalPoints')
    .populate('course', 'title')
    .select('score status feedback submittedAt gradedAt');

    res.status(200).json({
      success: true,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Error fetching assessment results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assessment results',
      error: error.message
    });
  }
};

// Get assessment results for a course (for instructors)
exports.getCourseAssessmentResults = async (req, res) => {
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

    const results = await AssessmentResult.find({ course: courseId })
      .populate('student', 'name email')
      .populate('assessment', 'title totalPoints')
      .select('score status feedback submittedAt gradedAt');

    res.status(200).json({
      success: true,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Error fetching course assessment results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course assessment results',
      error: error.message
    });
  }
};

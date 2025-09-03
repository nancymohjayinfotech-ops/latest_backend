const User = require('../models/User');
const Course = require('../models/Course');
const Event = require('../models/Event');
const Payment = require('../models/Payment');
const Group = require('../models/Group');
const Assessment = require('../models/Assessment');
const Quiz = require('../models/Quiz');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// ============= DASHBOARD API =============
exports.getDashboardStats = async (req, res) => {
  try {
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const startOfWeek = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay()));

    // Total counts
    const totalUsers = await User.countDocuments({ 
    role: { $ne: 'admin' },
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }]
  });
    const totalStudents = await User.countDocuments({ 
      role: 'student',
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }]
    });
    const totalInstructors = await User.countDocuments({ 
      role: 'instructor',
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }]
    });
    const totalCourses = await Course.countDocuments({
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }]
    });
    const totalEvents = await Event.countDocuments({
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }]
    });

    // Revenue calculations
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const monthlyRevenue = await Payment.aggregate([
      { $match: { status: 'paid', createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Student enrollments
    const totalEnrollments = await User.aggregate([
      { $unwind: '$enrolledCourses' },
      { $count: 'total' }
    ]);

    const monthlyEnrollments = await User.aggregate([
      { $unwind: '$enrolledCourses' },
      { $match: { 'enrolledCourses.enrolledAt': { $gte: startOfMonth } } },
      { $count: 'total' }
    ]);

    // Recent activity - new user registrations
    const recentUsers = await User.find({ 
      role: { $ne: 'admin' },
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }]
    })
    .select('name email role createdAt avatar')
    .sort({ createdAt: -1 })
    .limit(1);

    // Recent payments
    const recentPayments = await Payment.find({ 
      status: 'paid',
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    })
    .populate('user', 'name email')
    .populate('course', 'title')
    .sort({ createdAt: -1 })
    .limit(10);

    // Analytics - user growth over last 12 months
    const userGrowthData = await User.aggregate([
      {
        $match: {
          role: { $ne: 'admin' },
          createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
          $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }]
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Revenue analytics over last 12 months
    const revenueAnalytics = await Payment.aggregate([
      {
        $match: {
          status: 'paid',
          createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalStudents,
          totalInstructors,
          totalCourses,
          totalEvents,
          totalRevenue: totalRevenue[0]?.total || 0,
          monthlyRevenue: monthlyRevenue[0]?.total || 0,
          totalEnrollments: totalEnrollments[0]?.total || 0,
          monthlyEnrollments: monthlyEnrollments[0]?.total || 0
        },
        recentActivity: {
          newUsers: recentUsers,
          recentPayments
        },
        analytics: {
          userGrowth: userGrowthData,
          revenueGrowth: revenueAnalytics
        }
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error.message
    });
  }
};

// ============= STUDENT MANAGEMENT =============
exports.getStudentStats = async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const activeStudents = await User.countDocuments({ 
      role: 'student', 
      isActive: true
    });
    const inactiveStudents = totalStudents - activeStudents;

    // Students with recent activity (last 30 days)
    const recentlyActive = await User.countDocuments({
      role: 'student',
      'enrolledCourses.lastAccessed': { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalStudents,
        isActive: activeStudents,
        isInactive: inactiveStudents,
        recentlyActive
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching student statistics',
      error: error.message
    });
  }
};

exports.getStudents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = { 
      role: 'student',
      isActive: true
    };

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status !== 'all') {
      query.isActive = status === 'active';
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const students = await User.find(query)
      .select('-password -otpHash -sessionToken -refreshToken')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        students,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching students',
      error: error.message
    });
  }
};

exports.getStudentDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await User.findOne({ _id: id, role: 'student' })
      .select('-password -otpHash -sessionToken -refreshToken')
      .populate('enrolledCourses.course', 'title thumbnail price instructor sections')
      .populate('enrolledCourses.course.instructor', 'name');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Calculate detailed course progress
    const enrolledCoursesWithProgress = await Promise.all(
      student.enrolledCourses.map(async (enrollment) => {
        const course = enrollment.course;
        const totalSections = course.sections.length;
        const totalVideos = course.sections.reduce((acc, section) => acc + section.videos.length, 0);
        const completedSections = enrollment.progress.completedSections.length;
        const completedVideos = enrollment.progress.completedVideos.length;
        
        const progressPercentage = totalVideos > 0 ? (completedVideos / totalVideos) * 100 : 0;

        // Get student's rating for this course
        const courseWithRating = await Course.findById(course._id);
        const studentRating = courseWithRating.ratings.find(r => r.user.toString() === student._id.toString());

        return {
          ...enrollment.toObject(),
          course: {
            ...course.toObject(),
            totalSections,
            totalVideos,
            completedSections,
            completedVideos,
            progressPercentage: Math.round(progressPercentage),
            studentRating: studentRating || null
          }
        };
      })
    );

    // Calculate overall stats
    const totalCourses = enrolledCoursesWithProgress.length;
    const completedCourses = enrolledCoursesWithProgress.filter(e => e.course.progressPercentage === 100).length;
    const inProgressCourses = enrolledCoursesWithProgress.filter(e => e.course.progressPercentage > 0 && e.course.progressPercentage < 100).length;

    // Get all reviews by student
    const allReviews = await Course.aggregate([
      { $unwind: '$ratings' },
      { $match: { 'ratings.user': student._id } },
      { $sort: { 'ratings.createdAt': -1 } },
      {
        $project: {
          rating: '$ratings.rating',
          review: '$ratings.review',
          createdAt: '$ratings.createdAt',
          courseTitle: '$title',
          courseId: '$_id'
        }
      },
      { $limit: 1 } 
    ]);

    const avgRating = allReviews.length > 0 
      ? allReviews.reduce((acc, review) => acc + review.rating, 0) / allReviews.length 
      : 0;

    res.status(200).json({
      success: true,
      data: {
        student: {
          ...student.toObject(),
          enrolledCourses: enrolledCoursesWithProgress
        },
        stats: {
          totalCourses,
          completedCourses,
          inProgressCourses,
          avgRating: Math.round(avgRating * 10) / 10
        },
        reviews: allReviews
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching student details',
      error: error.message
    });
  }
};

exports.createStudent = async (req, res) => {
  try {
    const studentData = req.body;

    // Create new student
    const newStudent = new User({
      ...studentData,
      role: 'student'
    });

    await newStudent.save();
    const student = await User.findById(newStudent._id)
      .select('-password -otpHash -sessionToken -refreshToken');

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating student',
      error: error.message
    });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Update existing student with only provided fields
    const student = await User.findOneAndUpdate(
      { _id: id, role: 'student' },
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -otpHash -sessionToken -refreshToken');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating student',
      error: error.message
    });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await User.findOneAndUpdate(
      { _id: id, role: 'student' },
      { 
        $set: { 
          isActive: false,
          deletedAt: new Date()
        }
      },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting student',
      error: error.message
    });
  }
};

// ============= INSTRUCTOR MANAGEMENT =============
exports.getInstructorStats = async (req, res) => {
  try {
    const totalInstructors = await User.countDocuments({ role: 'instructor' });
    const activeInstructors = await User.countDocuments({ 
      role: 'instructor', 
      isActive: true
    });

    // Total unique students under all instructors
    const totalStudentsUnder = await Course.aggregate([
      { $unwind: '$enrolledStudents' },
      { $group: { _id: '$enrolledStudents' } },
      { $count: 'total' }
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: totalInstructors,
        isActive: activeInstructors,
        isInactive: totalInstructors - activeInstructors,
        totalStudentsUnder: totalStudentsUnder[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching instructor statistics',
      error: error.message
    });
  }
};

exports.getInstructors = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {
      role: 'instructor',
      isActive: true
    };

    if (search) {
      query.$and = [
        {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { phoneNumber: { $regex: search, $options: 'i' } }
          ]
        }
      ];
      delete query.$or;
    }

    if (status !== 'all') {
      query.isActive = status === 'active';
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const instructors = await User.find(query)
      .select('-password -otpHash -sessionToken -refreshToken -interests -notificationPreferences')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        instructors,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching instructors',
      error: error.message
    });
  }
};

exports.getInstructorDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const instructor = await User.findOne({ _id: id, role: 'instructor' })
      .select('-password -otpHash -sessionToken -refreshToken -interests -notificationPreferences');

    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }

    // Get instructor's courses
    const courses = await Course.find({ instructor: id })
      .populate('category', 'name')
      .populate('subcategory', 'name');

    // Calculate performance stats
    const totalStudents = courses.reduce((acc, course) => acc + course.enrolledStudents.length, 0);
    const totalCourses = courses.length;
    const totalVideos = courses.reduce((acc, course) => 
      acc + course.sections.reduce((sectionAcc, section) => sectionAcc + section.videos.length, 0), 0
    );

    // Get quizzes and assessments created
    const quizzes = await Quiz.find({ createdBy: id });
    const assessments = await Assessment.find({ createdBy: id });
    
    // Get live sessions count (assuming events created by instructor)
    const liveSessions = await Event.find({ createdBy: id });

    // Calculate ratings
    const allRatings = courses.reduce((acc, course) => acc.concat(course.ratings), []);
    const avgRating = allRatings.length > 0 
      ? allRatings.reduce((acc, rating) => acc + rating.rating, 0) / allRatings.length 
      : 0;

    // Course-wise data with duration
    const coursesData = courses.map(course => ({
      _id: course._id,
      title: course.title,
      description: course.description,
      category: course.category,
      subcategory: course.subcategory,
      avgRating: course.averageRating,
      totalRatings: course.ratings.length,
      enrolledStudents: course.enrolledStudents.length,
      totalDuration: course.totalDuration,
      totalVideos: course.sections.reduce((acc, section) => acc + section.videos.length, 0),
      published: course.published,
      createdAt: course.createdAt
    }));

    res.status(200).json({
      success: true,
      data: {
        instructor,
        courses: coursesData,
        performance: {
          totalStudents,
          totalCourses,
          totalVideos,
          avgRating: Math.round(avgRating * 10) / 10,
          quizzesCreated: quizzes.length,
          assessmentsCreated: assessments.length,
          liveSessions: liveSessions.length
        },
        personalInfo: {
          email: instructor.email,
          phoneNumber: instructor.phoneNumber,
          specialization: instructor.expertise || [],
          joinDate: instructor.createdAt,
          bio: instructor.bio,
          skills: instructor.expertise || []
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching instructor details',
      error: error.message
    });
  }
};

exports.createInstructor = async (req, res) => {
  try {
    const instructorData = req.body;

    // Create new instructor
    const newInstructor = new User({
      ...instructorData,
      role: 'instructor'
    });

    await newInstructor.save();
    const instructor = await User.findById(newInstructor._id)
      .select('-password -otpHash -sessionToken -refreshToken');

    res.status(201).json({
      success: true,
      message: 'Instructor created successfully'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating instructor',
      error: error.message
    });
  }
};

exports.updateInstructor = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Update existing instructor with only provided fields
    const instructor = await User.findOneAndUpdate(
      { _id: id, role: 'instructor' },
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -otpHash -sessionToken -refreshToken');

    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Instructor updated successfully'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating instructor',
      error: error.message
    });
  }
};

exports.deleteInstructor = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if instructor has active courses
    const coursesCount = await Course.countDocuments({ 
      instructor: id,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }]
    });
    if (coursesCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete instructor with existing active courses'
      });
    }

    const instructor = await User.findOneAndUpdate(
      { _id: id, role: 'instructor' },
      { 
        $set: { 
          isActive: false,
          deletedAt: new Date()
        }
      },
      { new: true }
    );

    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Instructor deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting instructor',
      error: error.message
    });
  }
};

// ============= EVENT MANAGEMENT =============
exports.getEventStats = async (req, res) => {
  try {
    const currentDate = new Date();
    
    const totalEvents = await Event.countDocuments();
    const upcomingEvents = await Event.countDocuments({
      startDate: { $gte: currentDate },
      isActive: true,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }]
    });

    // Total attendance (approved enrollments)
    const totalAttendance = await Event.aggregate([
      { $unwind: '$enrollments' },
      { $match: { 'enrollments.status': 'approved' } },
      { $count: 'total' }
    ]);

    // Total revenue from paid events
    const totalRevenue = await Event.aggregate([
      { $match: { price: { $gt: 0 } } },
      { $unwind: '$enrollments' },
      { $match: { 'enrollments.status': 'approved' } },
      { $group: { _id: null, total: { $sum: '$price' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalEvents,
        upcomingEvents,
        totalAttendance: totalAttendance[0]?.total || 0,
        totalRevenue: totalRevenue[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching event statistics',
      error: error.message
    });
  }
};

exports.getEvents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = 'all',
      eventType = 'all',
      sortBy = 'startDate',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = { isActive: true };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    if (status !== 'all') {
      const currentDate = new Date();
      if (status === 'upcoming') {
        query.startDate = { $gte: currentDate };
        query.isActive = true;
      } else if (status === 'past') {
        query.endDate = { $lt: currentDate };
      } else if (status === 'active') {
        query.isActive = true;
      } else if (status === 'inactive') {
        query.isActive = false;
      }
    }

    if (eventType !== 'all') {
      query.eventType = eventType;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const events = await Event.find(query)
      .populate('createdBy', 'name email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Event.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching events',
      error: error.message
    });
  }
};

exports.getEventDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id)
      .populate('createdBy', 'name email avatar')
      .populate('enrollments.student', 'name email avatar phoneNumber');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const stats = {
      totalEnrollments: event.enrollments.length,
      approvedEnrollments: event.enrollments.filter(e => e.status === 'approved').length,
      pendingEnrollments: event.enrollments.filter(e => e.status === 'pending').length,
      declinedEnrollments: event.enrollments.filter(e => e.status === 'declined').length,
      revenue: event.price > 0 ? event.price * event.enrollments.filter(e => e.status === 'approved').length : 0,
      availableSlots: event.maxParticipants - event.enrollments.filter(e => e.status === 'approved').length
    };

    res.status(200).json({
      success: true,
      data: {
        event,
        stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching event details',
      error: error.message
    });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const eventData = req.body;

    // Create new event
    const newEvent = new Event({
      ...eventData,
      createdBy: req.user.id
    });

    await newEvent.save();
    const event = await Event.findById(newEvent._id)
      .populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating event',
      error: error.message
    });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Update existing event with only provided fields
    const event = await Event.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Event updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating event',
      error: error.message
    });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findByIdAndUpdate(
      id,
      { 
        $set: { 
          isActive: false,
          deletedAt: new Date()
        }
      },
      { new: true }
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting event',
      error: error.message
    });
  }
};

// ============= COURSE MANAGEMENT =============
exports.getCourseStats = async (req, res) => {
  try {
    const totalCourses = await Course.countDocuments();
    const activeCourses = await Course.countDocuments({ 
      published: true,
    });
    
    // Total students enrolled across all courses
    const totalEnrollments = await Course.aggregate([
      { $unwind: '$enrolledStudents' },
      { $group: { _id: '$enrolledStudents' } },
      { $count: 'total' }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalCourses,
        activeCourses,
        inactiveCourses: totalCourses - activeCourses,
        totalEnrollments: totalEnrollments[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching course statistics',
      error: error.message
    });
  }
};

exports.getCourses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = 'all',
      level = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = { published: true };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (status !== 'all') {
      query.published = status === 'active';
    }

    if (level !== 'all') {
      query.level = level;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const courses = await Course.find(query)
      .populate('instructor', 'name email')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .select('-ratings -sections') // Exclude heavy arrays
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Course.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        courses,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching courses',
      error: error.message
    });
  }
};

exports.getCourseDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findById(id)
      .populate('instructor', 'name email avatar bio')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('enrolledStudents', 'name email avatar')
      .populate('ratings.user', 'name avatar');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Calculate detailed stats
    const stats = {
      enrolledStudents: course.enrolledStudents.length,
      totalRatings: course.ratings.length,
      averageRating: course.averageRating,
      totalVideos: course.totalVideos,
      totalDuration: course.totalDuration,
      totalSections: course.sections.length,
      ratingDistribution: {
        5: course.ratings.filter(r => r.rating === 5).length,
        4: course.ratings.filter(r => r.rating === 4).length,
        3: course.ratings.filter(r => r.rating === 3).length,
        2: course.ratings.filter(r => r.rating === 2).length,
        1: course.ratings.filter(r => r.rating === 1).length
      }
    };

    res.status(200).json({
      success: true,
      data: {
        course,
        stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching course details',
      error: error.message
    });
  }
};

exports.createCourse = async (req, res) => {
  try {
    const courseData = req.body;

    // Create new course
    const newCourse = new Course({
      ...courseData
    });

    await newCourse.save();
    
    const course = await Course.findById(newCourse._id)
      .populate('instructor', 'name email')
      .populate('category', 'name')
      .populate('subcategory', 'name');

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating course',
      error: error.message
    });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Update existing course with only provided fields
    const course = await Course.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('instructor', 'name email')
     .populate('category', 'name')
     .populate('subcategory', 'name');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Course updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating course',
      error: error.message
    });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if course has enrolled students
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (course.enrolledStudents.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete course with enrolled students'
      });
    }

    await Course.findByIdAndUpdate(
      id,
      { 
        $set: { 
          published: false,
          deletedAt: new Date()
        }
      }
    );

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting course',
      error: error.message
    });
  }
};

// ============= GROUP MANAGEMENT =============
exports.getGroups = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {isActive: true};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const groups = await Group.find(query)
      .select('name category description students instructors isActive createdAt') // pick only needed fields
      .populate('students', '_id')  // only need _id to count
      .populate('instructors', '_id') // only need _id to count
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Group.countDocuments(query);

    // Transform groups to add totalMembers
    const formattedGroups = groups.map(group => ({
      _id: group._id,
      title: group.name,
      category: group.category,
      description: group.description,
      totalMembers: (group.students?.length || 0) + (group.instructors?.length || 0),
      status: group.isActive,
      createdAt: group.createdAt
    }));

    res.status(200).json({
      success: true,
      data: {
        groups: formattedGroups,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching groups',
      error: error.message
    });
  }
};

exports.getGroupDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, messageSort = 'desc' } = req.query;

    const group = await Group.findById(id)
      .populate('students', 'name email role avatar phoneNumber')
      .populate('instructors', 'name email role avatar phoneNumber')
      .populate('admin', 'name email avatar');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    const students = group.students;
    const instructors = group.instructors;

    // Fetch messages with pagination
    const Message = require('../models/Message');
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = messageSort === 'desc' ? -1 : 1;

    const messages = await Message.find({ groupId: id })
      .populate('senderId', 'name email avatar role')
      .sort({ createdAt: sortDirection })
      .skip(skip)
      .limit(parseInt(limit));

    const totalMessages = await Message.countDocuments({ groupId: id });

    res.status(200).json({
      success: true,
      data: {
        group,
        stats: {
          totalMembers: group.students.length + group.instructors.length,
          students: students.length,
          instructors: instructors.length,
          totalMessages
        },
        membersByRole: {
          students,
          instructors
        },
        messages: {
          data: messages,
          pagination: {
            current: parseInt(page),
            total: Math.ceil(totalMessages / parseInt(limit)),
            count: totalMessages,
            limit: parseInt(limit)
          }
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching group details',
      error: error.message
    });
  }
};

exports.getUsersForGroup = async (req, res) => {
  try {
    const { role = 'all', search = '', groupId } = req.query;
    
    const query = { role: { $in: ['student', 'instructor'] } };
    
    if (role !== 'all') {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Exclude users already in the group if groupId is provided
    if (groupId) {
      const group = await Group.findById(groupId);
      if (group) {
        query._id = { $nin: [...group.students, ...group.instructors] };
      }
    }

    const users = await User.find(query)
      .select('name email role avatar')
      .limit(50);

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

exports.createGroup = async (req, res) => {
  try {
    const groupData = req.body;

    // Create new group
    const newGroup = new Group({
      ...groupData,
      admin: req.user.id
    });

    await newGroup.save();
    const group = await Group.findById(newGroup._id);

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating group',
      error: error.message
    });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Update existing group with only provided fields
    const group = await Group.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Group updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating group',
      error: error.message
    });
  }
};

exports.addMembersToGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { members } = req.body; // Expected: [{ userId: "id", role: "student|instructor" }]

    if (!members || !Array.isArray(members)) {
      return res.status(400).json({
        success: false,
        message: 'Members array is required'
      });
    }

    const updateOperations = {};
    const studentIds = members.filter(m => m.role === 'student').map(m => m.userId);
    const instructorIds = members.filter(m => m.role === 'instructor').map(m => m.userId);

    if (studentIds.length > 0) {
      updateOperations.$addToSet = { ...updateOperations.$addToSet, students: { $each: studentIds } };
    }
    if (instructorIds.length > 0) {
      updateOperations.$addToSet = { ...updateOperations.$addToSet, instructors: { $each: instructorIds } };
    }

    const group = await Group.findByIdAndUpdate(
      id,
      updateOperations,
      { new: true }
    );

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Added ${studentIds.length} student(s) and ${instructorIds.length} instructor(s) to group`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding members to group',
      error: error.message
    });
  }
};

exports.removeMemberFromGroup = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const { role } = req.body; // Expected: "student" or "instructor"

    if (!role || !['student', 'instructor'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role is required and must be either "student" or "instructor"'
      });
    }

    const updateField = role === 'student' ? 'students' : 'instructors';
    const group = await Group.findByIdAndUpdate(
      id,
      { $pull: { [updateField]: memberId } },
      { new: true }
    );

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error removing member from group',
      error: error.message
    });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const group = await Group.findByIdAndUpdate(
      id,
      { 
        $set: { 
          isActive: false,
          deletedAt: new Date()
        }
      },
      { new: true }
    );

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting group',
      error: error.message
    });
  }
};

// ============= PROFILE & AUTH MANAGEMENT =============
exports.getProfile = async (req, res) => {
  try {
    const adminId = req.user.id;

    const admin = await User.findById(adminId)
      .select('-password -otpHash -sessionToken -refreshToken -refreshTokenExpiry -interests -notificationPreferences');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.status(200).json({
      success: true,
      data: admin
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const adminId = req.user.id;
    const updateData = req.body;

    const admin = await User.findByIdAndUpdate(
      adminId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -otpHash -sessionToken -refreshToken -refreshTokenExpiry -interests -notificationPreferences');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.user.id;

    const admin = await User.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password and invalidate session for security
    await User.findByIdAndUpdate(adminId, { 
      password: hashedNewPassword,
      sessionToken: null,
      refreshToken: null,
      refreshTokenExpiry: null
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please login again.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const adminId = req.user.id;

    // Clear session and refresh tokens
    await User.findByIdAndUpdate(adminId, {
      sessionToken: null,
      refreshToken: null,
      refreshTokenExpiry: null
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error logging out',
      error: error.message
    });
  }
};

const User = require('../models/User');
const Category = require('../models/Category');
const Course = require('../models/Course');
const Subcategory = require('../models/Subcategory');
const Group = require('../models/Group');
const Event = require('../models/Event');
const Assessment = require('../models/Assessment');
const Payment = require('../models/Payment');
// Get comprehensive dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    // Count users by role
    const studentCount = await User.countDocuments({ role: 'student' });
    const instructorCount = await User.countDocuments({ role: 'instructor' });
    
    // Count active and inactive categories
    const activeCategories = await Category.countDocuments({ isActive: true });
    const inactiveCategories = await Category.countDocuments({ isActive: false });
    const totalCategories = activeCategories + inactiveCategories;
    
    // Count active and inactive courses
    const activeCourses = await Course.countDocuments({ published: true });
    const inactiveCourses = await Course.countDocuments({ published: false });
    const totalCourses = activeCourses + inactiveCourses;
    
    // Count active and inactive subcategories
    const activeSubcategories = await Subcategory.countDocuments({ isActive: true });
    const inactiveSubcategories = await Subcategory.countDocuments({ isActive: false });
    const totalSubcategories = activeSubcategories + inactiveSubcategories;
    
    // Count total groups
    const totalGroups = await Group.countDocuments({});
    
    // Count active and inactive events
    const activeEvents = await Event.countDocuments({ isActive: true });
    const inactiveEvents = await Event.countDocuments({ isActive: false });
    const totalEvents = activeEvents + inactiveEvents;
    
    // Count assessments
    const activeAssessments = await Assessment.countDocuments({ isActive: true });
    const inactiveAssessments = await Assessment.countDocuments({ isActive: false });
    const totalAssessments = activeAssessments + inactiveAssessments;
    
    // Calculate payment statistics
    const totalPayments = await Payment.countDocuments({});
    const successfulPayments = await Payment.countDocuments({ status: 'paid' });
    const failedPayments = await Payment.countDocuments({ status: 'failed' });
    const pendingPayments = await Payment.countDocuments({ status: { $in: ['created', 'attempted'] } });
    
    // Calculate total revenue from successful payments by currency
    const revenueResult = await Payment.aggregate([
      { $match: { status: 'paid' } },
      { 
        $group: { 
          _id: '$currency', 
          totalRevenue: { $sum: '$amount' },
          count: { $sum: 1 }
        } 
      }
    ]);
    
    // Format revenue by currency
    const revenueByCurrency = {};
    let totalRevenueINR = 0;
    
    revenueResult.forEach(item => {
      const currency = item._id || 'INR';
      revenueByCurrency[currency] = {
        amount: item.totalRevenue,
        count: item.count
      };
      
      // Keep INR as primary for total calculation
      if (currency === 'INR') {
        totalRevenueINR = item.totalRevenue;
      }
    });
    
    // Calculate event enrollment statistics
    const eventsWithEnrollments = await Event.aggregate([
      { $unwind: { path: '$enrollments', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          totalEnrollments: { $sum: { $cond: [{ $ifNull: ['$enrollments', false] }, 1, 0] } },
          approvedEnrollments: {
            $sum: {
              $cond: [{ $eq: ['$enrollments.status', 'approved'] }, 1, 0]
            }
          },
          pendingEnrollments: {
            $sum: {
              $cond: [{ $eq: ['$enrollments.status', 'pending'] }, 1, 0]
            }
          }
        }
      }
    ]);
    
    const enrollmentStats = eventsWithEnrollments.length > 0 ? eventsWithEnrollments[0] : {
      totalEnrollments: 0,
      approvedEnrollments: 0,
      pendingEnrollments: 0
    };
    
    // Return comprehensive stats
    res.status(200).json({
      success: true,
      message: 'Dashboard statistics fetched successfully',
      stats: {
        users: {
          students: studentCount,
          instructors: instructorCount,
          total: studentCount + instructorCount
        },
        categories: {
          isActive: activeCategories,
          isInactive: inactiveCategories,
          total: totalCategories
        },
        subcategories: {
          isActive: activeSubcategories,
          isInactive: inactiveSubcategories,
          total: totalSubcategories
        },
        courses: {
          isActive: activeCourses,
          isInactive: inactiveCourses,
          total: totalCourses
        },
        groups: {
          total: totalGroups
        },
        events: {
          isActive: activeEvents,
          isInactive: inactiveEvents,
          total: totalEvents
        },
        assessments: {
          isActive: activeAssessments,
          isInactive: inactiveAssessments,
          total: totalAssessments
        },
        payments: {
          total: totalPayments,
          successful: successfulPayments,
          failed: failedPayments,
          pending: pendingPayments,
          revenueByCurrency: revenueByCurrency,
          totalRevenueINR: totalRevenueINR
        },
        eventEnrollments: {
          total: enrollmentStats.totalEnrollments,
          approved: enrollmentStats.approvedEnrollments,
          pending: enrollmentStats.pendingEnrollments,
          declined: enrollmentStats.totalEnrollments - enrollmentStats.approvedEnrollments - enrollmentStats.pendingEnrollments
        }
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard statistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error.message
    });
  }
};

module.exports = {
  getDashboardStats
};

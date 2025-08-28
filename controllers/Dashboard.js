const User = require('../models/User');
const Category = require('../models/Category');
const Course = require('../models/Course');
const Subcategory = require('../models/Subcategory');
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
          active: activeCategories,
          inactive: inactiveCategories,
          total: totalCategories
        },
        subcategories: {
          active: activeSubcategories,
          inactive: inactiveSubcategories,
          total: totalSubcategories
        },
        courses: {
          active: activeCourses,
          inactive: inactiveCourses,
          total: totalCourses
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

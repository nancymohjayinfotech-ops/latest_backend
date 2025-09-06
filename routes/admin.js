const express = require('express');
const router = express.Router();
const adminController = require('../controllers/Admin');
const { protect, authorize } = require('../middleware/mongoAuth');

// Apply admin authentication to all routes
router.use(protect,authorize('admin'));

// ============= DASHBOARD ROUTES =============
router.get('/dashboard/stats', adminController.getDashboardStats);

// ============= STUDENT MANAGEMENT ROUTES =============
router.get('/students/stats', adminController.getStudentStats);
router.get('/students', adminController.getStudents);
router.get('/students/:id', adminController.getStudentDetail);
router.post('/students', adminController.createStudent);
router.patch('/students/:id', adminController.updateStudent);
router.delete('/students/:id', adminController.deleteStudent);

// ============= INSTRUCTOR MANAGEMENT ROUTES =============
router.get('/instructors/stats', adminController.getInstructorStats);
router.get('/instructors/all', adminController.getAllInstructors);
router.get('/instructors', adminController.getInstructors);
router.get('/instructors/:id', adminController.getInstructorDetail);
router.post('/instructors', adminController.createInstructor);
router.patch('/instructors/:id', adminController.updateInstructor);
router.delete('/instructors/:id', adminController.deleteInstructor);

// ============= EVENT MANAGEMENT ROUTES =============
router.get('/events/stats', adminController.getEventStats);
router.get('/events', adminController.getEvents);
router.get('/events/:id', adminController.getEventDetail);
router.post('/events', adminController.createEvent);
router.patch('/events/:id', adminController.updateEvent);
router.delete('/events/:id', adminController.deleteEvent);

// ============= COURSE MANAGEMENT ROUTES =============
router.get('/courses/stats', adminController.getCourseStats);
router.get('/courses', adminController.getCourses);
router.get('/courses/:id', adminController.getCourseDetail);
router.post('/courses', adminController.createCourse);
router.patch('/courses/:id', adminController.updateCourse);
router.delete('/courses/:id', adminController.deleteCourse);

// ============= COURSE CREATION HELPER ROUTES =============
router.get('/categories', adminController.getAllCategories);
router.get('/categories/:categoryId/subcategories', adminController.getSubcategoriesByCategory);

// ============= GROUP MANAGEMENT ROUTES =============
router.get('/groups', adminController.getGroups);
router.get('/groups/:id', adminController.getGroupDetail);
router.get('/groups/users/available', adminController.getUsersForGroup);
router.post('/groups', adminController.createGroup);
router.patch('/groups/:id', adminController.updateGroup);
router.post('/groups/:id/members', adminController.addMembersToGroup);
router.delete('/groups/:id/members/:memberId', adminController.removeMemberFromGroup);
router.delete('/groups/:id', adminController.deleteGroup);

// ============= PROFILE & AUTH ROUTES =============
router.get('/profile', adminController.getProfile);
router.patch('/profile', adminController.updateProfile);
router.patch('/profile/password', adminController.changePassword);
router.post('/logout', adminController.logout);

module.exports = router;

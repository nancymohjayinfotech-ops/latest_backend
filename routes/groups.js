const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/mongoAuth');
const groupController = require('../controllers/Group');
const messageController = require('../controllers/Message');

// Group routes
router.post('/', protect,authorize('admin','instructor','event'), groupController.createGroup);
router.get('/', protect,authorize('admin','instructor','event'), groupController.getAllGroups);

// Get groups for current user
router.get('/my-groups', protect,authorize('student','instructor','event'), groupController.getGroupsForUser);
router.get('/:groupId/with-messages', protect,authorize('admin','student','instructor','event'), groupController.getGroupWithMessages);

router.get('/:groupId', protect,authorize('admin','student','instructor','event'), groupController.getGroupById);
router.get('/:groupId/members', protect,authorize('admin','student','instructor','event'), groupController.getGroupMembers);

// Instructor management routes
router.post('/:groupId/instructors', protect,authorize('admin'), groupController.addInstructor);
router.delete('/:groupId/instructors/:instructorId', protect,authorize('admin'), groupController.removeInstructor);

// Student management routes
router.post('/:groupId/students/:studentId', protect,authorize('admin','instructor','event'), groupController.addStudent);
router.delete('/:groupId/students/:studentId', protect,authorize('admin','instructor','event'), groupController.removeStudent);
router.post('/:groupId/leave', protect,authorize('student'), groupController.leaveGroup);

// Event organizer management routes
router.post('/:groupId/events', protect,authorize('admin'), groupController.addEvent);
router.delete('/:groupId/events/:eventId', protect,authorize('admin'), groupController.removeEvent);

// Message routes
router.post('/:groupId/messages', protect, authorize('admin','instructor','event'), (req, res) => {
  // Add groupId from URL params to request body
  req.body.groupId = req.params.groupId;
  messageController.createMessage(req, res);
});

router.get('/:groupId/messages', protect, authorize('admin','student','instructor','event'), (req, res) => {
  // Pass groupId from URL params
  req.params.groupId = req.params.groupId;
  messageController.getMessagesByGroupId(req, res);
});

// Mark message as read
router.post('/:groupId/messages/:messageId/read', protect, authorize('admin','student','instructor','event'), messageController.markMessageAsRead);

module.exports = router;

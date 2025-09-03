const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/mongoAuth');
const groupController = require('../controllers/Group');
const messageController = require('../controllers/Message');

// Group routes
router.post('/', protect,authorize('admin'), groupController.createGroup);
router.get('/', protect,authorize('admin','instructor'), groupController.getAllGroups);

// Get groups for current user
router.get('/my-groups', protect,authorize('student','instructor','event'), groupController.getGroupsForUser);
router.get('/:groupId/with-messages', protect,authorize('admin','student','instructor','event'), groupController.getGroupWithMessages);

router.get('/:groupId', protect,authorize('admin','student','instructor','event'), groupController.getGroupById);
router.get('/:groupId/members', protect,authorize('admin','student','instructor','event'), groupController.getGroupMembers);

// Instructor management routes
router.post('/:groupId/instructors', protect,authorize('admin'), groupController.addInstructor);
router.delete('/:groupId/instructors/:instructorId', protect,authorize('admin'), groupController.removeInstructor);

// Student management routes
router.post('/:groupId/students/:studentId', protect,authorize('admin','instructor'), groupController.addStudent);
router.delete('/:groupId/students/:studentId', protect,authorize('admin','instructor'), groupController.removeStudent);
router.post('/:groupId/leave', protect,authorize('student'), groupController.leaveGroup);

// Message routes
router.post('/:groupId/messages', protect, authorize('admin','instructor'), (req, res) => {
  // Add groupId from URL params to request body
  req.body.groupId = req.params.groupId;
  messageController.createMessage(req, res);
});

router.get('/:groupId/messages', protect, authorize('admin','student','instructor'), (req, res) => {
  // Pass groupId from URL params
  req.params.groupId = req.params.groupId;
  messageController.getMessagesByGroupId(req, res);
});

// Mark message as read
router.post('/:groupId/messages/:messageId/read', protect, authorize('admin','student','instructor'), messageController.markMessageAsRead);

module.exports = router;

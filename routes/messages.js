const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/mongoAuth');
const messageController = require('../controllers/Message');

// Create a new message via REST API (in addition to socket.io)
router.post('/', protect, messageController.createMessage);

// Get messages for a group
router.get('/group/:groupId', protect, messageController.getMessagesByGroupId);

// Get recent messages for user's groups
router.get('/recent', protect, messageController.getRecentMessagesForUser);

// Get a single message
router.get('/:id', protect, messageController.getMessageById);

// Update a message (only by sender or admin)
router.put('/:id', protect, messageController.updateMessage);

// Delete a message (only by sender or admin)
router.delete('/:id', protect, messageController.deleteMessage);

module.exports = router;

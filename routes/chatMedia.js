const express = require('express');
const router = express.Router();
const chatMediaController = require('../controllers/ChatMedia');
const { uploadChatFile, uploadChatFiles } = require('../middleware/chatUploadMiddleware');
const { protect } = require('../middleware/mongoAuth');

// Apply authentication middleware to all routes
router.use(protect);

// Upload single media file for chat
router.post('/upload', uploadChatFile('file'), chatMediaController.uploadChatMedia);

// Upload multiple media files for chat
router.post('/upload-multiple', uploadChatFiles('files', 5), chatMediaController.uploadMultipleChatMedia);

// Get media file by filename (for serving files)
router.get('/file/:filename', chatMediaController.getChatMedia);

// Delete media message and file
router.delete('/message/:messageId', chatMediaController.deleteChatMedia);

// Get chat media history for a group
router.get('/history/:groupId', chatMediaController.getChatMediaHistory);

module.exports = router;

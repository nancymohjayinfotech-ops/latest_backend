const Message = require('../models/Message');
const { getChatFileInfo, getMessageTypeFromFile, deleteChatFile } = require('../middleware/chatUploadMiddleware');
const { getEncryptionInstance } = require('../utils/encryption');
const path = require('path');

// Upload single media file for chat
exports.uploadChatMedia = async (req, res) => {
  try {
    const { groupId, content = '' } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    // Get file information
    const fileInfo = getChatFileInfo(req.file);
    const messageType = getMessageTypeFromFile(req.file);

    // Create message with media
    const messageData = {
      groupId,
      senderId: req.user.id,
      senderName: req.user.name,
      content: content || `Shared a ${messageType}`,
      messageType,
      media: {
        url: fileInfo.url,
        filename: fileInfo.filename,
        mimetype: fileInfo.mimetype,
        size: fileInfo.size
      }
    };

    // Encrypt content if needed
    if (messageData.content) {
      const encryption = getEncryptionInstance();
      messageData.content = encryption.encrypt(messageData.content);
    }

    const message = new Message(messageData);
    await message.save();

    // Return the message with decrypted content for immediate use
    const responseMessage = message.toJSON();

    // Broadcast message to all users in the group via socket
    const io = req.app.get('io');
    if (io) {
      io.to(groupId).emit('newMessage', responseMessage);
    }

    res.status(200).json({
      success: true,
      message: 'Media uploaded successfully',
      data: responseMessage
    });

  } catch (error) {
    console.error('Error uploading chat media:', error);
    
    // Delete uploaded file if message creation failed
    if (req.file) {
      deleteChatFile(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload media',
      error: error.message
    });
  }
};

// Upload multiple media files for chat
exports.uploadMultipleChatMedia = async (req, res) => {
  try {
    const { groupId, content = '' } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    const messages = [];
    const failedUploads = [];
    const io = req.app.get('io');

    // Process each file
    for (const file of req.files) {
      try {
        const fileInfo = getChatFileInfo(file);
        const messageType = getMessageTypeFromFile(file);

        const messageData = {
          groupId,
          senderId: req.user.id,
          senderName: req.user.name,
          content: content || `Shared a ${messageType}`,
          messageType,
          media: {
            url: fileInfo.url,
            filename: fileInfo.filename,
            mimetype: fileInfo.mimetype,
            size: fileInfo.size
          }
        };

        // Encrypt content if needed
        if (messageData.content) {
          const encryption = getEncryptionInstance();
          messageData.content = encryption.encrypt(messageData.content);
        }

        const message = new Message(messageData);
        await message.save();

        // Get decrypted message for response and broadcasting
        const responseMessage = message.toJSON();
        messages.push(responseMessage);

        // Broadcast each message to all users in the group via socket
        if (io) {
          io.to(groupId).emit('newMessage', responseMessage);
        }

      } catch (error) {
        console.error(`Error processing file ${file.filename}:`, error);
        failedUploads.push({
          filename: file.filename,
          error: error.message
        });
        
        // Delete failed file
        deleteChatFile(file.path);
      }
    }

    res.status(200).json({
      success: true,
      message: `${messages.length} media files uploaded successfully`,
      data: {
        messages,
        failedUploads: failedUploads.length > 0 ? failedUploads : undefined
      }
    });

  } catch (error) {
    console.error('Error uploading multiple chat media:', error);
    
    // Delete all uploaded files if batch failed
    if (req.files) {
      req.files.forEach(file => deleteChatFile(file.path));
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload media files',
      error: error.message
    });
  }
};

// Get media file by filename (for serving files)
exports.getChatMedia = async (req, res) => {
  try {
    const { filename } = req.params;

    if (!filename) {
      return res.status(400).json({
        success: false,
        message: 'Filename is required'
      });
    }

    const filePath = path.join(__dirname, '../uploads/chat', filename);
    
    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Send file
    res.sendFile(filePath);

  } catch (error) {
    console.error('Error serving chat media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to serve media file',
      error: error.message
    });
  }
};

// Delete media message and file
exports.deleteChatMedia = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: 'Message ID is required'
      });
    }

    // Find the message
    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is the sender or has admin privileges
    if (message.senderId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages'
      });
    }

    // Delete file if it exists
    if (message.media && message.media.filename) {
      const filePath = path.join(__dirname, '../uploads/chat', message.media.filename);
      deleteChatFile(filePath);
    }

    // Delete message from database
    await Message.findByIdAndDelete(messageId);

    res.status(200).json({
      success: true,
      message: 'Media message deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting chat media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete media message',
      error: error.message
    });
  }
};

// Get chat media history for a group
exports.getChatMediaHistory = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 20, mediaType } = req.query;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    // Build query
    const query = {
      groupId,
      messageType: { $ne: 'text' } // Only media messages
    };

    // Filter by media type if specified
    if (mediaType && ['image', 'video', 'document', 'audio'].includes(mediaType)) {
      query.messageType = mediaType;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get media messages
    const mediaMessages = await Message.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('senderId', 'name profilePicture')
      .lean();

    // Get total count
    const totalCount = await Message.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        messages: mediaMessages,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: skip + mediaMessages.length < totalCount,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error getting chat media history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get media history',
      error: error.message
    });
  }
};

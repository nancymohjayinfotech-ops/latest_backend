const Message = require('../models/Message');
const Group = require('../models/Group');
const { getEncryptionInstance } = require('../utils/encryption');

// Model functions
// Create a new message
const createMessageModel = async(messageData) => {
    try {
        // Encrypt the message content before saving
        if (messageData.content) {
            const encryption = getEncryptionInstance();
            messageData.content = encryption.encrypt(messageData.content);
            messageData.isEncrypted = true;
        }

        const message = new Message(messageData);
        await message.save();

        // Populate sender details
        await message.populate('senderId', 'name email avatar');
        await message.populate('groupId', 'name');

        // The content will be automatically decrypted by the model's toJSON transform
        return message;
    } catch (error) {
        console.error('Error creating message:', error);
        throw error;
    }
};

// Controller functions
// Create a new message - Route handler
exports.createMessage = async(req, res) => {
    try {
        const messageData = {
            groupId: req.body.groupId,
            senderId: req.user.id, // From auth middleware
            senderName: req.user.name || req.body.senderName,
            content: req.body.content,
            isEdited: false,
            isSystemMessage: req.body.isSystemMessage || false,
            messageType: req.body.messageType || 'text'
        };

        const message = await createMessageModel(messageData);

        // Emit to all users in the group
        const io = req.app.get('io');
        if (io) {
            io.to(messageData.groupId.toString()).emit('newMessage', message);
        }

        res.status(201).json({
            success: true,
            message: 'Message created successfully',
            data: message
        });
    } catch (error) {
        console.error('Error creating message via API:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating message',
            error: error.message
        });
    }
};

// Get messages for a group - Model function
const getMessagesByGroupIdModel = async(groupId, limit = 50, offset = 0) => {
    try {
        const messages = await Message.find({ groupId })
            .populate('senderId', 'name email avatar')
            .populate('groupId', 'name')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(offset);

        return messages.reverse(); // Return in chronological order
    } catch (error) {
        console.error('Error getting messages by group ID:', error);
        return [];
    }
};

// Get messages for a group - Route handler
exports.getMessagesByGroupId = async(req, res) => {
    try {
        const { page, limit } = req.query;
        const groupId = req.params.groupId;

        // Extract pagination parameters
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;
        const offset = (pageNum - 1) * limitNum;

        // Verify user has access to this group
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if user is a member of the group
        const userId = req.user.id;
        const isAdmin = group.admin.toString() === userId.toString();
        const isInstructor = group.instructors.some(id => id.toString() === userId.toString());
        const isStudent = group.students.some(id => id.toString() === userId.toString());

        if (!isAdmin && !isInstructor && !isStudent) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this group\'s messages'
            });
        }

        // Get total message count for pagination
        const totalMessages = await Message.countDocuments({ groupId });

        const messages = await getMessagesByGroupIdModel(
            groupId,
            limitNum,
            offset
        );

        // Add read status for current user and read count
        const messagesWithReadStatus = messages.map(message => {
            const messageObj = message.toObject ? message.toObject() : message;
            const isReadByCurrentUser = messageObj.readBy?.some(read =>
                read && read.userId && read.userId.toString() === userId.toString()
            ) || false;
            const readCount = messageObj.readBy?.length || 0;

            return {
                ...messageObj,
                isReadByCurrentUser,
                readCount,
                readBy: messageObj.readBy // Keep full readBy array for detailed info if needed
            };
        });

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalMessages / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        res.status(200).json({
            success: true,
            message: 'Messages retrieved successfully',
            data: {
                messages: messagesWithReadStatus,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalMessages,
                    limit: limitNum,
                    hasNextPage,
                    hasPrevPage
                }
            }
        });
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting messages',
            error: error.message
        });
    }
};

// Get message by ID - Model function
const getMessageByIdModel = async(messageId) => {
    try {
        const message = await Message.findById(messageId)
            .populate('senderId', 'name email avatar')
            .populate('groupId', 'name');

        // The content will be automatically decrypted by the model's toJSON transform
        return message;
    } catch (error) {
        console.error('Error getting message by ID:', error);
        return null;
    }
};

// Get message by ID - Route handler
exports.getMessageById = async(req, res) => {
    try {
        const message = await getMessageByIdModel(req.params.id);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        res.status(200).json({
            success: true,
            data: message
        });
    } catch (error) {
        console.error('Error getting message:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting message',
            error: error.message
        });
    }
};

// Update message - Model function
const updateMessageModel = async(messageId, updateData) => {
    try {
        // If content is being updated, encrypt it
        if (updateData.content) {
            const encryption = getEncryptionInstance();
            updateData.content = encryption.encrypt(updateData.content);
            updateData.isEncrypted = true;
        }

        const message = await Message.findByIdAndUpdate(
                messageId,
                updateData, { new: true, runValidators: true }
            ).populate('senderId', 'name email avatar')
            .populate('groupId', 'name');

        // The content will be automatically decrypted by the model's toJSON transform
        return message;
    } catch (error) {
        console.error('Error updating message:', error);
        throw error;
    }
};

// Update message - Route handler
exports.updateMessage = async(req, res) => {
    try {
        const message = await getMessageByIdModel(req.params.id);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Check if user is sender or admin
        if (message.senderId._id.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this message'
            });
        }

        const updatedMessage = await updateMessageModel(req.params.id, {
            content: req.body.content,
            isEdited: true
        });

        // Emit update to all users in the group
        const io = req.app.get('io');
        if (io) {
            io.to(message.groupId._id.toString()).emit('messageUpdated', updatedMessage);
        }

        res.status(200).json({
            success: true,
            data: updatedMessage
        });
    } catch (error) {
        console.error('Error updating message:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating message',
            error: error.message
        });
    }
};

// Delete message - Model function
const deleteMessageModel = async(messageId) => {
    try {
        await Message.findByIdAndDelete(messageId);
        return { success: true };
    } catch (error) {
        console.error('Error deleting message:', error);
        throw error;
    }
};

// Delete message - Route handler
exports.deleteMessage = async(req, res) => {
    try {
        const message = await getMessageByIdModel(req.params.id);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Check if user is sender or admin
        if (message.senderId._id.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this message'
            });
        }

        await deleteMessageModel(req.params.id);

        // Emit deletion to all users in the group
        const io = req.app.get('io');
        if (io) {
            io.to(message.groupId._id.toString()).emit('messageDeleted', {
                messageId: req.params.id,
                groupId: message.groupId._id
            });
        }

        res.status(200).json({
            success: true,
            message: 'Message deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting message',
            error: error.message
        });
    }
};

// Get recent messages for user's groups - Model function
const getRecentMessagesForUserModel = async(userId, limit = 20) => {
    try {
        // Find all groups the user is a member of
        const userGroups = await Group.find({
            $or: [
                { admin: userId },
                { instructors: userId },
                { students: userId }
            ]
        }).select('_id');

        const groupIds = userGroups.map(group => group._id);

        // Get recent messages from these groups
        const messages = await Message.find({ groupId: { $in: groupIds } })
            .populate('senderId', 'name email avatar')
            .populate('groupId', 'name')
            .sort({ createdAt: -1 })
            .limit(limit);

        return messages;
    } catch (error) {
        console.error('Error getting recent messages for user:', error);
        return [];
    }
};

// Get recent messages for user's groups - Route handler
exports.getRecentMessagesForUser = async(req, res) => {
    try {
        const userId = req.user.id;
        const { limit } = req.query;

        const messages = await getRecentMessagesForUserModel(
            userId,
            parseInt(limit) || 20
        );

        res.status(200).json({
            success: true,
            count: messages.length,
            data: messages
        });
    } catch (error) {
        console.error('Error getting recent messages:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting recent messages',
            error: error.message
        });
    }
};

// Mark message as read - Route handler
exports.markMessageAsRead = async(req, res) => {
    try {
        const messageId = req.params.messageId;
        const userId = req.user.id;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Verify user has access to this group
        const group = await Group.findById(message.groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if user is a member of the group
        const isAdmin = group.admin.toString() === userId.toString();
        const isInstructor = group.instructors.some(id => id.toString() === userId.toString());
        const isStudent = group.students.some(id => id.toString() === userId.toString());

        if (!isAdmin && !isInstructor && !isStudent) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this group\'s messages'
            });
        }

        // Check if user already marked this message as read
        const alreadyRead = message.readBy.some(read => read.userId.toString() === userId.toString());

        if (alreadyRead) {
            return res.status(200).json({
                success: true,
                message: 'Message already marked as read'
            });
        }

        // Mark message as read
        await Message.findByIdAndUpdate(messageId, {
            $push: {
                readBy: {
                    userId: userId,
                    readAt: new Date()
                }
            }
        });

        res.status(200).json({
            success: true,
            message: 'Message marked as read'
        });
    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking message as read',
            error: error.message
        });
    }
};

// Export model functions for internal use
module.exports.models = {
    createMessage: createMessageModel,
    getMessagesByGroupId: getMessagesByGroupIdModel,
    getMessageById: getMessageByIdModel,
    updateMessage: updateMessageModel,
    deleteMessage: deleteMessageModel,
    getRecentMessagesForUser: getRecentMessagesForUserModel
};

const Message = require('../models/Message');
const Group = require('../models/Group');
const { getEncryptionInstance } = require('../utils/encryption');

// Model functions
// Create a new message
const createMessageModel = async(messageData) => {
    try {
        // Encrypt the message content before saving
        if (messageData.content) {
            const encryption = getEncryptionInstance();
            messageData.content = encryption.encrypt(messageData.content);
            messageData.isEncrypted = true;
        }

        const message = new Message(messageData);
        await message.save();

        // Populate sender details
        await message.populate('senderId', 'name email avatar');
        await message.populate('groupId', 'name');

        // The content will be automatically decrypted by the model's toJSON transform
        return message;
    } catch (error) {
        console.error('Error creating message:', error);
        throw error;
    }
};

// Controller functions
// Create a new message - Route handler
exports.createMessage = async(req, res) => {
    try {
        const messageData = {
            groupId: req.body.groupId,
            senderId: req.user.id, // From auth middleware
            senderName: req.user.name || req.body.senderName,
            content: req.body.content,
            isEdited: false,
            isSystemMessage: req.body.isSystemMessage || false,
            messageType: req.body.messageType || 'text'
        };

        const message = await createMessageModel(messageData);

        // Emit to all users in the group
        const io = req.app.get('io');
        if (io) {
            io.to(messageData.groupId.toString()).emit('newMessage', message);
        }

        res.status(201).json({
            success: true,
            message: 'Message created successfully',
            data: message
        });
    } catch (error) {
        console.error('Error creating message via API:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating message',
            error: error.message
        });
    }
};

// Get messages for a group - Model function
const getMessagesByGroupIdModel = async(groupId, limit = 50, offset = 0) => {
    try {
        const messages = await Message.find({ groupId })
            .populate('senderId', 'name email avatar')
            .populate('groupId', 'name')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(offset);

        return messages.reverse(); // Return in chronological order
    } catch (error) {
        console.error('Error getting messages by group ID:', error);
        return [];
    }
};

// Get messages for a group - Route handler
exports.getMessagesByGroupId = async(req, res) => {
    try {
        const { page, limit } = req.query;
        const groupId = req.params.groupId;

        // Extract pagination parameters
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;
        const offset = (pageNum - 1) * limitNum;

        // Verify user has access to this group
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if user is a member of the group
        const userId = req.user.id;
        const isAdmin = group.admin.toString() === userId.toString();
        const isInstructor = group.instructors.some(id => id.toString() === userId.toString());
        const isStudent = group.students.some(id => id.toString() === userId.toString());

        if (!isAdmin && !isInstructor && !isStudent) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this group\'s messages'
            });
        }

        // Get total message count for pagination
        const totalMessages = await Message.countDocuments({ groupId });

        const messages = await getMessagesByGroupIdModel(
            groupId,
            limitNum,
            offset
        );

        // Add read status for current user and read count
        const messagesWithReadStatus = messages.map(message => {
            const messageObj = message.toObject ? message.toObject() : message;
            const isReadByCurrentUser = messageObj.readBy?.some(read =>
                read && read.userId && read.userId.toString() === userId.toString()
            ) || false;
            const readCount = messageObj.readBy?.length || 0;

            return {
                ...messageObj,
                isReadByCurrentUser,
                readCount,
                readBy: messageObj.readBy // Keep full readBy array for detailed info if needed
            };
        });

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalMessages / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        res.status(200).json({
            success: true,
            message: 'Messages retrieved successfully',
            data: {
                messages: messagesWithReadStatus,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalMessages,
                    limit: limitNum,
                    hasNextPage,
                    hasPrevPage
                }
            }
        });
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting messages',
            error: error.message
        });
    }
};

// Get message by ID - Model function
const getMessageByIdModel = async(messageId) => {
    try {
        const message = await Message.findById(messageId)
            .populate('senderId', 'name email avatar')
            .populate('groupId', 'name');

        // The content will be automatically decrypted by the model's toJSON transform
        return message;
    } catch (error) {
        console.error('Error getting message by ID:', error);
        return null;
    }
};

// Get message by ID - Route handler
exports.getMessageById = async(req, res) => {
    try {
        const message = await getMessageByIdModel(req.params.id);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        res.status(200).json({
            success: true,
            data: message
        });
    } catch (error) {
        console.error('Error getting message:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting message',
            error: error.message
        });
    }
};

// Update message - Model function
const updateMessageModel = async(messageId, updateData) => {
    try {
        // If content is being updated, encrypt it
        if (updateData.content) {
            const encryption = getEncryptionInstance();
            updateData.content = encryption.encrypt(updateData.content);
            updateData.isEncrypted = true;
        }

        const message = await Message.findByIdAndUpdate(
                messageId,
                updateData, { new: true, runValidators: true }
            ).populate('senderId', 'name email avatar')
            .populate('groupId', 'name');

        // The content will be automatically decrypted by the model's toJSON transform
        return message;
    } catch (error) {
        console.error('Error updating message:', error);
        throw error;
    }
};

// Update message - Route handler
exports.updateMessage = async(req, res) => {
    try {
        const message = await getMessageByIdModel(req.params.id);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Check if user is sender or admin
        if (message.senderId._id.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this message'
            });
        }

        const updatedMessage = await updateMessageModel(req.params.id, {
            content: req.body.content,
            isEdited: true
        });

        // Emit update to all users in the group
        const io = req.app.get('io');
        if (io) {
            io.to(message.groupId._id.toString()).emit('messageUpdated', updatedMessage);
        }

        res.status(200).json({
            success: true,
            data: updatedMessage
        });
    } catch (error) {
        console.error('Error updating message:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating message',
            error: error.message
        });
    }
};

// Delete message - Model function
const deleteMessageModel = async(messageId) => {
    try {
        await Message.findByIdAndDelete(messageId);
        return { success: true };
    } catch (error) {
        console.error('Error deleting message:', error);
        throw error;
    }
};

// Delete message - Route handler
exports.deleteMessage = async(req, res) => {
    try {
        const message = await getMessageByIdModel(req.params.id);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Check if user is sender or admin
        if (message.senderId._id.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this message'
            });
        }

        await deleteMessageModel(req.params.id);

        // Emit deletion to all users in the group
        const io = req.app.get('io');
        if (io) {
            io.to(message.groupId._id.toString()).emit('messageDeleted', {
                messageId: req.params.id,
                groupId: message.groupId._id
            });
        }

        res.status(200).json({
            success: true,
            message: 'Message deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting message',
            error: error.message
        });
    }
};

// Get recent messages for user's groups - Model function
const getRecentMessagesForUserModel = async(userId, limit = 20) => {
    try {
        // Find all groups the user is a member of
        const userGroups = await Group.find({
            $or: [
                { admin: userId },
                { instructors: userId },
                { students: userId }
            ]
        }).select('_id');

        const groupIds = userGroups.map(group => group._id);

        // Get recent messages from these groups
        const messages = await Message.find({ groupId: { $in: groupIds } })
            .populate('senderId', 'name email avatar')
            .populate('groupId', 'name')
            .sort({ createdAt: -1 })
            .limit(limit);

        return messages;
    } catch (error) {
        console.error('Error getting recent messages for user:', error);
        return [];
    }
};

// Get recent messages for user's groups - Route handler
exports.getRecentMessagesForUser = async(req, res) => {
    try {
        const userId = req.user.id;
        const { limit } = req.query;

        const messages = await getRecentMessagesForUserModel(
            userId,
            parseInt(limit) || 20
        );

        res.status(200).json({
            success: true,
            count: messages.length,
            data: messages
        });
    } catch (error) {
        console.error('Error getting recent messages:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting recent messages',
            error: error.message
        });
    }
};

// Mark message as read - Route handler
exports.markMessageAsRead = async(req, res) => {
    try {
        const messageId = req.params.messageId;
        const userId = req.user.id;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Verify user has access to this group
        const group = await Group.findById(message.groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if user is a member of the group
        const isAdmin = group.admin.toString() === userId.toString();
        const isInstructor = group.instructors.some(id => id.toString() === userId.toString());
        const isStudent = group.students.some(id => id.toString() === userId.toString());

        if (!isAdmin && !isInstructor && !isStudent) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this group\'s messages'
            });
        }

        // Check if user already marked this message as read
        const alreadyRead = message.readBy.some(read => read.userId.toString() === userId.toString());

        if (alreadyRead) {
            return res.status(200).json({
                success: true,
                message: 'Message already marked as read'
            });
        }

        // Mark message as read
        await Message.findByIdAndUpdate(messageId, {
            $push: {
                readBy: {
                    userId: userId,
                    readAt: new Date()
                }
            }
        });

        res.status(200).json({
            success: true,
            message: 'Message marked as read'
        });
    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking message as read',
            error: error.message
        });
    }
};

// Export model functions for internal use
module.exports.models = {
    createMessage: createMessageModel,
    getMessagesByGroupId: getMessagesByGroupIdModel,
    getMessageById: getMessageByIdModel,
    updateMessage: updateMessageModel,
    deleteMessage: deleteMessageModel,
    getRecentMessagesForUser: getRecentMessagesForUserModel
};

const Message = require('../models/Message');
const Group = require('../models/Group');
const { getEncryptionInstance } = require('../utils/encryption');

// Model functions
// Create a new message
const createMessageModel = async(messageData) => {
    try {
        // Encrypt the message content before saving
        if (messageData.content) {
            const encryption = getEncryptionInstance();
            messageData.content = encryption.encrypt(messageData.content);
            messageData.isEncrypted = true;
        }

        const message = new Message(messageData);
        await message.save();

        // Populate sender details
        await message.populate('senderId', 'name email avatar');
        await message.populate('groupId', 'name');

        // The content will be automatically decrypted by the model's toJSON transform
        return message;
    } catch (error) {
        console.error('Error creating message:', error);
        throw error;
    }
};

// Controller functions
// Create a new message - Route handler
exports.createMessage = async(req, res) => {
    try {
        const messageData = {
            groupId: req.body.groupId,
            senderId: req.user.id, // From auth middleware
            senderName: req.user.name || req.body.senderName,
            content: req.body.content,
            isEdited: false,
            isSystemMessage: req.body.isSystemMessage || false,
            messageType: req.body.messageType || 'text'
        };

        const message = await createMessageModel(messageData);

        // Emit to all users in the group
        const io = req.app.get('io');
        if (io) {
            io.to(messageData.groupId.toString()).emit('newMessage', message);
        }

        res.status(201).json({
            success: true,
            message: 'Message created successfully',
            data: message
        });
    } catch (error) {
        console.error('Error creating message via API:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating message',
            error: error.message
        });
    }
};

// Get messages for a group - Model function
const getMessagesByGroupIdModel = async(groupId, limit = 50, offset = 0) => {
    try {
        const messages = await Message.find({ groupId })
            .populate('senderId', 'name email avatar')
            .populate('groupId', 'name')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(offset);

        return messages.reverse(); // Return in chronological order
    } catch (error) {
        console.error('Error getting messages by group ID:', error);
        return [];
    }
};

// Get messages for a group - Route handler
exports.getMessagesByGroupId = async(req, res) => {
    try {
        const { page, limit } = req.query;
        const groupId = req.params.groupId;

        // Extract pagination parameters
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;
        const offset = (pageNum - 1) * limitNum;

        // Verify user has access to this group
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if user is a member of the group
        const userId = req.user.id;
        const isAdmin = group.admin.toString() === userId.toString();
        const isInstructor = group.instructors.some(id => id.toString() === userId.toString());
        const isStudent = group.students.some(id => id.toString() === userId.toString());

        if (!isAdmin && !isInstructor && !isStudent) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this group\'s messages'
            });
        }

        // Get total message count for pagination
        const totalMessages = await Message.countDocuments({ groupId });

        const messages = await getMessagesByGroupIdModel(
            groupId,
            limitNum,
            offset
        );

        // Add read status for current user and read count
        const messagesWithReadStatus = messages.map(message => {
            const messageObj = message.toObject ? message.toObject() : message;
            const isReadByCurrentUser = messageObj.readBy?.some(read =>
                read && read.userId && read.userId.toString() === userId.toString()
            ) || false;
            const readCount = messageObj.readBy?.length || 0;

            return {
                ...messageObj,
                isReadByCurrentUser,
                readCount,
                readBy: messageObj.readBy // Keep full readBy array for detailed info if needed
            };
        });

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalMessages / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        res.status(200).json({
            success: true,
            message: 'Messages retrieved successfully',
            data: {
                messages: messagesWithReadStatus,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalMessages,
                    limit: limitNum,
                    hasNextPage,
                    hasPrevPage
                }
            }
        });
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting messages',
            error: error.message
        });
    }
};

// Get message by ID - Model function
const getMessageByIdModel = async(messageId) => {
    try {
        const message = await Message.findById(messageId)
            .populate('senderId', 'name email avatar')
            .populate('groupId', 'name');

        // The content will be automatically decrypted by the model's toJSON transform
        return message;
    } catch (error) {
        console.error('Error getting message by ID:', error);
        return null;
    }
};

// Get message by ID - Route handler
exports.getMessageById = async(req, res) => {
    try {
        const message = await getMessageByIdModel(req.params.id);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        res.status(200).json({
            success: true,
            data: message
        });
    } catch (error) {
        console.error('Error getting message:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting message',
            error: error.message
        });
    }
};

// Update message - Model function
const updateMessageModel = async(messageId, updateData) => {
    try {
        // If content is being updated, encrypt it
        if (updateData.content) {
            const encryption = getEncryptionInstance();
            updateData.content = encryption.encrypt(updateData.content);
            updateData.isEncrypted = true;
        }

        const message = await Message.findByIdAndUpdate(
                messageId,
                updateData, { new: true, runValidators: true }
            ).populate('senderId', 'name email avatar')
            .populate('groupId', 'name');

        // The content will be automatically decrypted by the model's toJSON transform
        return message;
    } catch (error) {
        console.error('Error updating message:', error);
        throw error;
    }
};

// Update message - Route handler
exports.updateMessage = async(req, res) => {
    try {
        const message = await getMessageByIdModel(req.params.id);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Check if user is sender or admin
        if (message.senderId._id.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this message'
            });
        }

        const updatedMessage = await updateMessageModel(req.params.id, {
            content: req.body.content,
            isEdited: true
        });

        // Emit update to all users in the group
        const io = req.app.get('io');
        if (io) {
            io.to(message.groupId._id.toString()).emit('messageUpdated', updatedMessage);
        }

        res.status(200).json({
            success: true,
            data: updatedMessage
        });
    } catch (error) {
        console.error('Error updating message:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating message',
            error: error.message
        });
    }
};

// Delete message - Model function
const deleteMessageModel = async(messageId) => {
    try {
        await Message.findByIdAndDelete(messageId);
        return { success: true };
    } catch (error) {
        console.error('Error deleting message:', error);
        throw error;
    }
};

// Delete message - Route handler
exports.deleteMessage = async(req, res) => {
    try {
        const message = await getMessageByIdModel(req.params.id);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Check if user is sender or admin
        if (message.senderId._id.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this message'
            });
        }

        await deleteMessageModel(req.params.id);

        // Emit deletion to all users in the group
        const io = req.app.get('io');
        if (io) {
            io.to(message.groupId._id.toString()).emit('messageDeleted', {
                messageId: req.params.id,
                groupId: message.groupId._id
            });
        }

        res.status(200).json({
            success: true,
            message: 'Message deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting message',
            error: error.message
        });
    }
};

// Get recent messages for user's groups - Model function
const getRecentMessagesForUserModel = async(userId, limit = 20) => {
    try {
        // Find all groups the user is a member of
        const userGroups = await Group.find({
            $or: [
                { admin: userId },
                { instructors: userId },
                { students: userId }
            ]
        }).select('_id');

        const groupIds = userGroups.map(group => group._id);

        // Get recent messages from these groups
        const messages = await Message.find({ groupId: { $in: groupIds } })
            .populate('senderId', 'name email avatar')
            .populate('groupId', 'name')
            .sort({ createdAt: -1 })
            .limit(limit);

        return messages;
    } catch (error) {
        console.error('Error getting recent messages for user:', error);
        return [];
    }
};

// Get recent messages for user's groups - Route handler
exports.getRecentMessagesForUser = async(req, res) => {
    try {
        const userId = req.user.id;
        const { limit } = req.query;

        const messages = await getRecentMessagesForUserModel(
            userId,
            parseInt(limit) || 20
        );

        res.status(200).json({
            success: true,
            count: messages.length,
            data: messages
        });
    } catch (error) {
        console.error('Error getting recent messages:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting recent messages',
            error: error.message
        });
    }
};

// Mark message as read - Route handler
exports.markMessageAsRead = async(req, res) => {
    try {
        const messageId = req.params.messageId;
        const userId = req.user.id;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Verify user has access to this group
        const group = await Group.findById(message.groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if user is a member of the group
        const isAdmin = group.admin.toString() === userId.toString();
        const isInstructor = group.instructors.some(id => id.toString() === userId.toString());
        const isStudent = group.students.some(id => id.toString() === userId.toString());

        if (!isAdmin && !isInstructor && !isStudent) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this group\'s messages'
            });
        }

        // Check if user already marked this message as read
        const alreadyRead = message.readBy.some(read => read.userId.toString() === userId.toString());

        if (alreadyRead) {
            return res.status(200).json({
                success: true,
                message: 'Message already marked as read'
            });
        }

        // Mark message as read
        await Message.findByIdAndUpdate(messageId, {
            $push: {
                readBy: {
                    userId: userId,
                    readAt: new Date()
                }
            }
        });

        res.status(200).json({
            success: true,
            message: 'Message marked as read'
        });
    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking message as read',
            error: error.message
        });
    }
};

// Export model functions for internal use
module.exports.models = {
    createMessage: createMessageModel,
    getMessagesByGroupId: getMessagesByGroupIdModel,
    getMessageById: getMessageByIdModel,
    updateMessage: updateMessageModel,
    deleteMessage: deleteMessageModel,
    getRecentMessagesForUser: getRecentMessagesForUserModel
};

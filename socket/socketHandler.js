const messageController = require('../controllers/Message');
const { getEncryptionInstance } = require('../utils/encryption');
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');

function initializeSocket(io) {
    io.on('connection', (socket) => {
        console.log('🔗 New client connected:', socket.id);

        // Store user data when they authenticate
        // socket.on('authenticate', (userData) => {
        //     console.log('📥 authenticate event received:', userData);
        
        //     if (userData && userData.userId) {
        //         socket.userData = userData;
        //         console.log(`✅ User authenticated: ${userData.userId} (${userData.name})`);
        //     } else {
        //         console.warn('⚠️ Authentication failed, invalid userData:', userData);
        //     }
        // });

        socket.on('authenticate', (userData) => {
            const decoded = jwt.verify(userData.token, process.env.JWT_SECRET);
            if (decoded && decoded.id) {
              // Store user data in socket for later use
              socket.userData = {
                userId: decoded.id,
                name: decoded.name,
              };
            }
          });

        // Join a group chat room
        socket.on('joinGroup', (data, callback) => {
            try {
                const groupId = data.groupId;
                console.log(`📥 joinGroup event received from ${socket.id}:`, data);

                socket.join(groupId);
                console.log(`✅ Client ${socket.id} joined group: ${groupId}`);

                // 🔑 Send acknowledgment back to Flutter
                if (callback) {
                    callback({ success: true, groupId });
                }

                // Broadcast to group members
                if (socket.userData) {
                    socket.to(groupId).emit('userJoined', {
                        userId: socket.userData.userId,
                        name: socket.userData.name,
                        groupId,
                        timestamp: new Date()
                    });
                }
            } catch (err) {
                console.error('❌ joinGroup error:', err);
                if (callback) {
                    callback({ success: false, error: err.message });
                }
            }
        });


        // Leave a group chat room
        socket.on('leaveGroup', (groupId) => {
            console.log(`📥 leaveGroup event received from ${socket.id}:`, groupId);
            socket.leave(groupId);
            console.log(`✅ Client ${socket.id} left group: ${groupId}`);

            if (socket.userData) {
                console.log(`📢 Broadcasting userLeft for ${socket.userData.userId} in group ${groupId}`);
                socket.to(groupId).emit('userLeft', {
                    userId: socket.userData.userId,
                    name: socket.userData.name,
                    groupId,
                    timestamp: new Date()
                });
            }
        });

        // Handle new message from socket
        socket.on('sendMessage', async(data) => {
            console.log(`📥 sendMessage event from ${socket.id}:`, data);
            console.log(`user data ${socket.userData}`);
            // console.log("iuserdata recived",userData)
            try {
                if (!socket.userData || !socket.userData.userId) {
                    console.warn(`❌ Message rejected (unauthenticated user) from socket ${socket.id}`);
                    socket.emit('messageError', {
                        error: 'User not authenticated',
                        originalMessage: { groupId: data.groupId, messageType: data.messageType }
                    });
                    return;
                }

                const messageData = {
                    groupId: data.groupId,
                    senderId: socket.userData.userId,
                    senderName: socket.userData.name,
                    content: data.content,
                    messageType: data.messageType || 'text'
                };

                console.log('💾 Saving message to DB:', messageData);

                const savedMessage = await messageController.models.createMessage(messageData);

                console.log('✅ Message saved. Broadcasting newMessage to group:', data.groupId);
                io.to(data.groupId).emit('newMessage', savedMessage);
            } catch (error) {
                console.error('❌ Error saving message:', error);
                socket.emit('messageError', {
                    error: 'Failed to save message',
                    originalMessage: { groupId: data.groupId, messageType: data.messageType }
                });
            }
        });

        // Handle message typing indicator
        socket.on('typing', (data) => {
            console.log(`⌨️ typing event in group ${data.groupId}:`, data);
            socket.to(data.groupId).emit('typingStatus', {
                userId: data.userId,
                name: data.name,
                groupId: data.groupId,
                isTyping: data.isTyping
            });
        });

        // Handle message read receipts
        socket.on('messageRead', async(data) => {
            console.log(`📥 messageRead event received:`, data);
            try {
                const message = await Message.findById(data.messageId);
                if (message) {
                    const alreadyRead = message.readBy.some(
                        (read) => read.userId && read.userId.toString() === data.userId.toString()
                    );

                    if (!alreadyRead) {
                        console.log(`📌 Marking message ${data.messageId} as read by ${data.userId}`);
                        await Message.findByIdAndUpdate(
                            data.messageId, {
                                $push: {
                                    readBy: {
                                        userId: data.userId,
                                        readAt: new Date()
                                    }
                                }
                            }, { new: true }
                        );
                    } else {
                        console.log(`ℹ️ Message ${data.messageId} already marked read by ${data.userId}`);
                    }

                    console.log(`📢 Broadcasting messageReadReceipt in group ${data.groupId}`);
                    socket.to(data.groupId).emit('messageReadReceipt', {
                        messageId: data.messageId,
                        userId: data.userId,
                        groupId: data.groupId,
                        timestamp: new Date()
                    });
                } else {
                    console.warn(`⚠️ Message not found: ${data.messageId}`);
                }
            } catch (error) {
                console.error('❌ Error marking message as read:', error);
                socket.emit('messageError', {
                    error: 'Failed to mark message as read',
                    originalMessage: { messageId: data.messageId }
                });
            }
        });

        // Disconnect
        socket.on('disconnect', () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
        });
    });
}

module.exports = initializeSocket;
const messageController = require('../controllers/Message');
const { getEncryptionInstance } = require('../utils/encryption');
const Message = require('../models/Message');

function initializeSocket(io) {

  //  io.use((socket, next) => {
  //   try {
  //     const authHeader = socket.handshake.headers['authorization'];
  //     if (!authHeader || !authHeader.startsWith("Bearer ")) {
  //       return next(new Error("Authentication error: Missing or invalid token"));
  //     }

  //     const token = authHeader.split(" ")[1];
  //     const decoded = jwt.verify(token, process.env.JWT_SECRET);

  //     // Attach user to socket for later use
  //     socket.userData = {
  //       userId: decoded.id,
  //       name: decoded.name
  //     };

  //     next(); 
  //   } catch (err) {
  //     console.error("Socket auth failed:", err.message);
  //     next(new Error("Authentication error"));
  //   }
  // });

  
  io.on('connection', (socket) => {
    console.log('New client connected', socket.id);
    
    // Store user data when they authenticate
    socket.on('authenticate', (userData) => {
      if (userData && userData.userId) {
        // Store user data in socket for later use
        socket.userData = userData;
        console.log(`User authenticated: ${userData.userId} (${userData.name})`);
      }
    });
    
    // Join a group chat room
    // socket.on('joinGroup', (groupId) => {
    //   socket.join(groupId);
    //   console.log(`Client ${socket.id} joined group: ${groupId}`);
      
    //   // Notify the room that someone joined
    //   if (socket.userData) {
    //     socket.to(groupId).emit('userJoined', { 
    //       userId: socket.userData.userId,
    //       name: socket.userData.name,
    //       groupId: groupId,
    //       timestamp: new Date()
    //     });
    //   } else {
    //     socket.to(groupId).emit('userJoined', { message: 'A new user joined the chat' });
    //   }
    // });

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
      socket.leave(groupId);
      console.log(`Client ${socket.id} left group: ${groupId}`);
      
      // Notify the room that someone left
      if (socket.userData) {
        socket.to(groupId).emit('userLeft', { 
          userId: socket.userData.userId,
          name: socket.userData.name,
          groupId: groupId,
          timestamp: new Date()
        });
      }
    });
    
    // Handle new message from socket
    socket.on('sendMessage', async (data) => {
      try {
        // Check if user is authenticated
        if (!socket.userData || !socket.userData.userId) {
          socket.emit('messageError', {
            error: 'User not authenticated',
            originalMessage: { groupId: data.groupId, messageType: data.messageType }
          });
          return;
        }
        
        // Create message in database using authenticated user data
        const messageData = {
          groupId: data.groupId,
          senderId: socket.userData.userId,
          senderName: socket.userData.name,
          content: data.content,
          messageType: data.messageType || 'text',
          media: data.media || null
        };
        
        // Save to database using model function (encryption happens in the model function)
        const savedMessage = await messageController.models.createMessage(messageData);
        
        // Broadcast to all clients in the group including sender
        // The message is already decrypted by the model's toJSON transform
        io.to(data.groupId).emit('newMessage', savedMessage);
      } catch (error) {
        // Send error back to sender only
        socket.emit('messageError', {
          error: 'Failed to save message',
          originalMessage: { groupId: data.groupId, messageType: data.messageType }
        });
      }
    });
    
    // Handle message typing indicator
    socket.on('typing', (data) => {
      // Broadcast to everyone except sender
      socket.to(data.groupId).emit('typingStatus', {
        userId: data.userId,
        name: data.name,
        groupId: data.groupId,
        isTyping: data.isTyping
      });
    });
    
    // Handle message read receipts
    socket.on('messageRead', async (data) => {
      try {
        // Check if user already marked this message as read
        const message = await Message.findById(data.messageId);
        if (message) {
          const alreadyRead = message.readBy.some(read => 
            read.userId && read.userId.toString() === data.userId.toString()
          );
          
          if (!alreadyRead) {
            // Mark message as read in database with explicit userId
            const updateResult = await Message.findByIdAndUpdate(
              data.messageId, 
              {
                $push: {
                  readBy: {
                    userId: data.userId,
                    readAt: new Date()
                  }
                }
              },
              { new: true } // Return the updated document
            );
          }
          
          // Broadcast to everyone except sender
          socket.to(data.groupId).emit('messageReadReceipt', {
            messageId: data.messageId,
            userId: data.userId,
            groupId: data.groupId,
            timestamp: new Date()
          });
        }
      } catch (error) {
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

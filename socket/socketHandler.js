const messageController = require('../controllers/Message');
const { getEncryptionInstance } = require('../utils/encryption');

function initializeSocket(io) {
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
    socket.on('joinGroup', (groupId) => {
      socket.join(groupId);
      console.log(`Client ${socket.id} joined group: ${groupId}`);
      
      // Notify the room that someone joined
      if (socket.userData) {
        socket.to(groupId).emit('userJoined', { 
          userId: socket.userData.userId,
          name: socket.userData.name,
          groupId: groupId,
          timestamp: new Date()
        });
      } else {
        socket.to(groupId).emit('userJoined', { message: 'A new user joined the chat' });
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
        console.log('Message received via socket:', data.groupId);
        
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
          messageType: data.messageType || 'text'
        };
        
        // Save to database using model function (encryption happens in the model function)
        const savedMessage = await messageController.models.createMessage(messageData);
        
        // Broadcast to all clients in the group including sender
        // The message is already decrypted by the model's toJSON transform
        io.to(data.groupId).emit('newMessage', savedMessage);
      } catch (error) {
        console.error('Error handling socket message:', error);
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
      socket.to(data.groupId).emit('userTyping', {
        userId: data.userId,
        name: data.name,
        groupId: data.groupId,
        isTyping: data.isTyping
      });
    });
    
    // Handle message read receipts
    socket.on('messageRead', async (data) => {
      // Broadcast to everyone except sender
      socket.to(data.groupId).emit('messageReadReceipt', {
        messageId: data.messageId,
        userId: data.userId,
        groupId: data.groupId,
        timestamp: new Date()
      });
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected', socket.id);
      
      // If we had stored which rooms this socket was in, we could notify them
      // For now, we don't track this information across the socket lifetime
    });
  });
}

module.exports = initializeSocket;

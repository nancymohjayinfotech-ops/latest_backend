/**
 * Client-side encryption utility for chat applications
 * This is a sample implementation that can be used with different frontend frameworks
 */

class ChatEncryptionClient {
  constructor(options = {}) {
    this.encryptionEnabled = options.encryptionEnabled !== false;
    this.socket = options.socket;
    this.userId = options.userId;
    this.userName = options.userName;
    this.groupId = options.groupId;
  }

  /**
   * Connect to the chat server
   * @param {Object} userData - User data for authentication
   */
  connect(userData) {
    if (!this.socket) {
      throw new Error('Socket instance is required');
    }

    // Authenticate with the server
    this.socket.emit('authenticate', userData);
    
    // Join the specified group
    if (this.groupId) {
      this.socket.emit('joinGroup', this.groupId);
    }
  }

  /**
   * Send a message to the server
   * @param {string} content - The message content
   * @param {string} messageType - The type of message (text, image, file)
   * @returns {Promise} - Resolves when the message is acknowledged
   */
  sendMessage(content, messageType = 'text') {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('Socket not connected'));
      }

      if (!content) {
        return reject(new Error('Message content is required'));
      }

      // The server handles encryption, so we just send the plain text
      const messageData = {
        content: content,
        groupId: this.groupId,
        messageType: messageType
      };

      // Send the message
      this.socket.emit('sendMessage', messageData);
      
      // Set up a one-time listener for message acknowledgment
      const messageTimeout = setTimeout(() => {
        this.socket.off('newMessage');
        this.socket.off('messageError');
        reject(new Error('Message send timeout'));
      }, 5000);

      // Listen for message error
      this.socket.once('messageError', (error) => {
        clearTimeout(messageTimeout);
        reject(error);
      });

      // Listen for new message (our own message will be echoed back)
      this.socket.on('newMessage', (message) => {
        if (message.senderId._id === this.userId && 
            message.content === content) {
          clearTimeout(messageTimeout);
          this.socket.off('newMessage');
          this.socket.off('messageError');
          resolve(message);
        }
      });
    });
  }

  /**
   * Listen for new messages
   * @param {Function} callback - Called when a new message is received
   */
  onNewMessage(callback) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    this.socket.on('newMessage', (message) => {
      // The server already decrypts the message, so we just pass it to the callback
      callback(message);
    });
  }

  /**
   * Listen for message updates
   * @param {Function} callback - Called when a message is updated
   */
  onMessageUpdated(callback) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    this.socket.on('messageUpdated', (message) => {
      callback(message);
    });
  }

  /**
   * Listen for message deletions
   * @param {Function} callback - Called when a message is deleted
   */
  onMessageDeleted(callback) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    this.socket.on('messageDeleted', (data) => {
      callback(data);
    });
  }

  /**
   * Disconnect from the chat server
   */
  disconnect() {
    if (this.socket) {
      if (this.groupId) {
        this.socket.emit('leaveGroup', this.groupId);
      }
      this.socket.disconnect();
    }
  }
}

// For CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatEncryptionClient;
}

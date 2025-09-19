const mongoose = require('mongoose');
const { getEncryptionInstance } = require('../utils/encryption');

const messageSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  media: {
    url: { type: String },
    filename: { type: String },
    mimetype: { type: String },
    size: { type: Number }
  },
  isEncrypted: {
    type: Boolean,
    default: true
  },
  isSystemMessage: {
    type: Boolean,
    default: false
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'video', 'document', 'audio'],
    default: 'text'
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  id: false
});

// Middleware to automatically decrypt content when document is retrieved
messageSchema.methods.decryptContent = function() {
  if (this.isEncrypted && this.content) {
    try {
      const encryption = getEncryptionInstance();
      return encryption.decrypt(this.content);
    } catch (error) {
      console.error('Error decrypting message:', error);
      return '[Encrypted message - unable to decrypt]';
    }
  }
  return this.content;
};

// Virtual property for decrypted content
messageSchema.virtual('decryptedContent').get(function() {
  return this.decryptContent();
});

// Configure toJSON and toObject to include virtuals and decrypt content
messageSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    if (ret.isEncrypted && ret.content) {
      try {
        const encryption = getEncryptionInstance();
        ret.content = encryption.decrypt(ret.content);
      } catch (error) {
        console.error('Error in toJSON transform:', error);
        ret.content = '[Encrypted message - unable to decrypt]';
      }
    }
    delete ret.isEncrypted; // Hide encryption status from API responses
    return ret;
  }
});

messageSchema.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    if (ret.isEncrypted && ret.content) {
      try {
        const encryption = getEncryptionInstance();
        ret.content = encryption.decrypt(ret.content);
      } catch (error) {
        console.error('Error in toObject transform:', error);
        ret.content = '[Encrypted message - unable to decrypt]';
      }
    }
    delete ret.isEncrypted; // Hide encryption status from API responses
    return ret;
  }
});

module.exports = mongoose.model('Message', messageSchema);

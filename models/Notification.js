const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null for system notifications
  },
  type: {
    type: String,
    enum: [
      'event_created',
      'event_updated',
      'event_reminder',
      'event_enrollment_approved',
      'event_enrollment_declined',
      'course_created',
      'course_updated',
      'course_published',
      'course_enrollment',
      'group_created',
      'group_member_added',
      'group_member_removed',
      'group_message',
      'assignment_due',
      'payment_success',
      'payment_failed',
      'system_announcement',
      'general'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  data: {
    // Additional data specific to notification type
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course'
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group'
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    // Generic data for custom notifications
    customData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'archived'],
    default: 'unread'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  // For scheduled notifications
  scheduledFor: {
    type: Date,
    default: null
  },
  isSent: {
    type: Boolean,
    default: false
  },
  sentAt: {
    type: Date,
    default: null
  },
  // Push notification details
  pushNotification: {
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: {
      type: Date,
      default: null
    },
    failureReason: {
      type: String,
      default: null
    }
  },
  // Email notification details
  emailNotification: {
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: {
      type: Date,
      default: null
    },
    failureReason: {
      type: String,
      default: null
    }
  },
  expiresAt: {
    type: Date,
    default: null // For notifications that should auto-expire
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better performance
notificationSchema.index({ recipient: 1, status: 1, createdAt: -1 });
notificationSchema.index({ type: 1, scheduledFor: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
notificationSchema.index({ deletedAt: 1 });

// Virtual for checking if notification is expired
notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

// Method to mark as sent
notificationSchema.methods.markAsSent = function() {
  this.isSent = true;
  this.sentAt = new Date();
  return this.save();
};

// Static method to create notification
notificationSchema.statics.createNotification = async function(notificationData) {
  try {
    const notification = new this(notificationData);
    await notification.save();
    return notification;
  } catch (error) {
    throw new Error(`Failed to create notification: ${error.message}`);
  }
};

// Static method to get user notifications with pagination
notificationSchema.statics.getUserNotifications = async function(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    status = null,
    type = null,
    unreadOnly = false
  } = options;

  const query = {
    recipient: userId,
    deletedAt: null
  };

  if (status) query.status = status;
  if (type) query.type = type;
  if (unreadOnly) query.isRead = false;

  const skip = (page - 1) * limit;

  const notifications = await this.find(query)
    .populate('sender', 'name avatar')
    .populate('data.eventId', 'title startDate')
    .populate('data.courseId', 'title thumbnail')
    .populate('data.groupId', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await this.countDocuments(query);

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to mark multiple notifications as read
notificationSchema.statics.markMultipleAsRead = async function(userId, notificationIds) {
  return await this.updateMany(
    {
      _id: { $in: notificationIds },
      recipient: userId
    },
    {
      $set: {
        isRead: true,
        status: 'read',
        readAt: new Date()
      }
    }
  );
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({
    recipient: userId,
    isRead: false,
    deletedAt: null
  });
};

module.exports = mongoose.model('Notification', notificationSchema);

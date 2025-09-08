const Notification = require('../models/Notification');
const User = require('../models/User');
const Event = require('../models/Event');
const Course = require('../models/Course');
const Group = require('../models/Group');
const { sendPushNotificationToUser, sendPushNotificationToUsers } = require('../services/firebaseService');

// Get user notifications with pagination and filters
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      status,
      type,
      unreadOnly = false
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      type,
      unreadOnly: unreadOnly === 'true'
    };

    const result = await Notification.getUserNotifications(userId, options);

    res.status(200).json({
      success: true,
      data: result.notifications,
      pagination: result.pagination,
      unreadCount: await Notification.getUnreadCount(userId)
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
};

// Get unread notifications count
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await Notification.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      unreadCount: count
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
      error: error.message
    });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOne({
      _id: notificationId,
      recipient: userId,
      deletedAt: null
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.markAsRead();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
};

// Mark multiple notifications as read
const markMultipleAsRead = async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification IDs provided'
      });
    }

    const result = await Notification.markMultipleAsRead(userId, notificationIds);

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Mark multiple as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read',
      error: error.message
    });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await Notification.updateMany(
      {
        recipient: userId,
        isRead: false,
        deletedAt: null
      },
      {
        $set: {
          isRead: true,
          status: 'read',
          readAt: new Date()
        }
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        recipient: userId,
        deletedAt: null
      },
      {
        deletedAt: new Date()
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
};

// Create notification (Admin/System use)
const createNotification = async (req, res) => {
  try {
    const {
      recipients,
      type,
      title,
      message,
      data = {},
      priority = 'medium',
      scheduledFor = null
    } = req.body;

    // Validate required fields
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Recipients array is required'
      });
    }

    if (!type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Type, title, and message are required'
      });
    }

    const notifications = [];
    const senderId = req.user?.id || null;

    // Create notification for each recipient
    for (const recipientId of recipients) {
      const notificationData = {
        recipient: recipientId,
        sender: senderId,
        type,
        title,
        message,
        data,
        priority,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null
      };

      const notification = await Notification.createNotification(notificationData);
      notifications.push(notification);
    }

    res.status(201).json({
      success: true,
      message: `${notifications.length} notifications created successfully`,
      data: notifications
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification',
      error: error.message
    });
  }
};

// Get notification statistics (Admin use)
const getNotificationStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const matchQuery = {
      deletedAt: null
    };

    if (startDate && endDate) {
      matchQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const stats = await Notification.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalNotifications: { $sum: 1 },
          unreadNotifications: {
            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
          },
          readNotifications: {
            $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] }
          },
          byType: {
            $push: {
              type: '$type',
              count: 1
            }
          },
          byPriority: {
            $push: {
              priority: '$priority',
              count: 1
            }
          }
        }
      }
    ]);

    // Get type distribution
    const typeStats = await Notification.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get priority distribution
    const priorityStats = await Notification.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {
          totalNotifications: 0,
          unreadNotifications: 0,
          readNotifications: 0
        },
        typeDistribution: typeStats,
        priorityDistribution: priorityStats
      }
    });
  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification statistics',
      error: error.message
    });
  }
};

// Update notification preferences
const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          notificationPreferences: preferences
        }
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: user.notificationPreferences
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification preferences',
      error: error.message
    });
  }
};

// Get notification preferences
const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('notificationPreferences');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user.notificationPreferences
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification preferences',
      error: error.message
    });
  }
};

// Utility function to create event notifications
const createEventNotification = async (eventData, type, recipients = []) => {
  try {
    const { title, _id: eventId } = eventData;
    
    let notificationTitle, notificationMessage;
    
    switch (type) {
      case 'event_created':
        notificationTitle = 'New Event Available';
        notificationMessage = `A new event "${title}" has been created and is now available for registration.`;
        break;
      case 'event_updated':
        notificationTitle = 'Event Updated';
        notificationMessage = `The event "${title}" has been updated. Check the latest details.`;
        break;
      case 'event_reminder':
        notificationTitle = 'Event Reminder';
        notificationMessage = `Reminder: The event "${title}" is starting soon.`;
        break;
      default:
        notificationTitle = 'Event Notification';
        notificationMessage = `Update regarding event "${title}".`;
    }

    const notifications = [];
    
    for (const recipientId of recipients) {
      const notification = await Notification.createNotification({
        recipient: recipientId,
        type,
        title: notificationTitle,
        message: notificationMessage,
        data: { eventId },
        priority: type === 'event_reminder' ? 'high' : 'medium'
      });
      notifications.push(notification);
    }

    // Send push notifications
    try {
      await sendPushNotificationToUsers(recipients, {
        title: notificationTitle,
        message: notificationMessage,
        priority: type === 'event_reminder' ? 'high' : 'medium'
      }, {
        type,
        eventId: eventId.toString(),
        notificationId: notifications[0]?._id?.toString()
      });
    } catch (pushError) {
      console.error('Error sending push notifications for event:', pushError);
      // Don't fail the notification creation if push notifications fail
    }

    return notifications;
  } catch (error) {
    console.error('Create event notification error:', error);
    throw error;
  }
};

// Utility function to create course notifications
const createCourseNotification = async (courseData, type, recipients = []) => {
  try {
    const { title, _id: courseId } = courseData;
    
    let notificationTitle, notificationMessage;
    
    switch (type) {
      case 'course_created':
        notificationTitle = 'New Course Available';
        notificationMessage = `A new course "${title}" has been added to the platform.`;
        break;
      case 'course_published':
        notificationTitle = 'Course Published';
        notificationMessage = `The course "${title}" is now published and available for enrollment.`;
        break;
      case 'course_updated':
        notificationTitle = 'Course Updated';
        notificationMessage = `The course "${title}" has been updated with new content.`;
        break;
      default:
        notificationTitle = 'Course Notification';
        notificationMessage = `Update regarding course "${title}".`;
    }

    const notifications = [];
    
    for (const recipientId of recipients) {
      const notification = await Notification.createNotification({
        recipient: recipientId,
        type,
        title: notificationTitle,
        message: notificationMessage,
        data: { courseId },
        priority: 'medium'
      });
      notifications.push(notification);
    }

    // Send push notifications
    try {
      await sendPushNotificationToUsers(recipients, {
        title: notificationTitle,
        message: notificationMessage,
        priority: 'medium'
      }, {
        type,
        courseId: courseId.toString(),
        notificationId: notifications[0]?._id?.toString()
      });
    } catch (pushError) {
      console.error('Error sending push notifications for course:', pushError);
      // Don't fail the notification creation if push notifications fail
    }

    return notifications;
  } catch (error) {
    console.error('Create course notification error:', error);
    throw error;
  }
};

// Utility function to create group notifications
const createGroupNotification = async (groupData, type, recipients = [], additionalData = {}) => {
  try {
    const { name, _id: groupId } = groupData;
    
    let notificationTitle, notificationMessage;
    
    switch (type) {
      case 'group_created':
        notificationTitle = 'New Group Created';
        notificationMessage = `A new group "${name}" has been created.`;
        break;
      case 'group_member_added':
        notificationTitle = 'Added to Group';
        notificationMessage = `You have been added to the group "${name}".`;
        break;
      case 'group_member_removed':
        notificationTitle = 'Removed from Group';
        notificationMessage = `You have been removed from the group "${name}".`;
        break;
      default:
        notificationTitle = 'Group Notification';
        notificationMessage = `Update regarding group "${name}".`;
    }

    const notifications = [];
    
    for (const recipientId of recipients) {
      const notification = await Notification.createNotification({
        recipient: recipientId,
        type,
        title: notificationTitle,
        message: notificationMessage,
        data: { groupId, ...additionalData },
        priority: 'medium'
      });
      notifications.push(notification);
    }

    // Send push notifications
    try {
      await sendPushNotificationToUsers(recipients, {
        title: notificationTitle,
        message: notificationMessage,
        priority: 'medium'
      }, {
        type,
        groupId: groupId.toString(),
        notificationId: notifications[0]?._id?.toString(),
        ...additionalData
      });
    } catch (pushError) {
      console.error('Error sending push notifications for group:', pushError);
      // Don't fail the notification creation if push notifications fail
    }

    return notifications;
  } catch (error) {
    console.error('Create group notification error:', error);
    throw error;
  }
};

module.exports = {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  getNotificationStats,
  updateNotificationPreferences,
  getNotificationPreferences,
  // Utility functions for creating specific notifications
  createEventNotification,
  createCourseNotification,
  createGroupNotification
};

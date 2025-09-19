const admin = require('firebase-admin');
const { getMessaging, initializeFirebase: initFirebase, isFirebaseInitialized } = require('../config/firebase');
const User = require('../models/User');

// Initialize Firebase using the config module
const initializeFirebase = () => {
  return initFirebase();
};

const sendPushNotificationV2 = async (deviceToken, notification, data = {}) => {
  try {
    const app = initializeFirebase();
    if (!app) {
      throw new Error('Firebase not initialized');
    }

    // Construct the message
    const message = {
      token: deviceToken,
      notification: {
        title: notification.title,
        body: notification.message, // required for auto display
      },
      data: {
        notificationId: data.notificationId || '',
        type: data.type || 'general',
        eventId: data.eventId || '',
        courseId: data.courseId || '',
        groupId: data.groupId || '',
        userId: data.userId || '',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK', // required for handling taps
        ...data.customData
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'lms_notifications', // must exist on device
          sound: 'default',
          icon: notification.icon || 'ic_launcher', // ensure this drawable exists
        }
      },
      apns: {
        headers: {
          'apns-priority': '10', // high priority for iOS
        },
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.message,
            },
            sound: 'default',
            badge: notification.badge || 1,
          }
        }
      }
    };

    const messaging = getMessaging();
    const response = await messaging.send(message);

    console.log('Push notification sent successfully:', {
      messageId: response,
      deviceToken: deviceToken.substring(0, 20) + '...',
      title: notification.title,
      timestamp: new Date().toISOString()
    });

    return { success: true, messageId: response };

  } catch (error) {
    console.error('Error sending push notification:', error);

    if (error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token') {
      return { success: false, error: 'INVALID_TOKEN', message: error.message };
    }

    return { success: false, error: 'SEND_FAILED', message: error.message };
  }
};

// Send push notification to a single device
const sendPushNotification = async (deviceToken, notification, data = {}) => {
  try {
    const app = initializeFirebase();
    if (!app) {
      throw new Error('Firebase not initialized');
    }

    const message = {
      token: deviceToken,
      data: {
        title: notification.title,
        message: notification.message,
        notificationId: data.notificationId || '',
        type: data.type || 'general',
        eventId: data.eventId || '',
        courseId: data.courseId || '',
        groupId: data.groupId || '',
        userId: data.userId || '',
        clickAction: data.clickAction || 'FLUTTER_NOTIFICATION_CLICK',
        ...data.customData
      }
    };

    const messaging = getMessaging();
    const response = await messaging.send(message);
    console.log('Push notification sent successfully:', {
      messageId: response,
      deviceToken: deviceToken.substring(0, 20) + '...',
      title: notification.title,
      timestamp: new Date().toISOString()
    });
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Error sending push notification:', error);

    if (error.code === 'messaging/registration-token-not-registered' || 
        error.code === 'messaging/invalid-registration-token') {
      return { success: false, error: 'INVALID_TOKEN', message: error.message };
    }

    return { success: false, error: 'SEND_FAILED', message: error.message };
  }
};

// Send push notifications to multiple devices
const sendMulticastPushNotification = async (deviceTokens, notification, data = {}) => {
  try {
    const app = initializeFirebase();
    if (!app) {
      throw new Error('Firebase not initialized');
    }

    if (!deviceTokens || deviceTokens.length === 0) {
      return { success: true, results: [] };
    }

    // Filter out invalid tokens
    const validTokens = deviceTokens.filter(token => token && typeof token === 'string');
    
    if (validTokens.length === 0) {
      return { success: true, results: [] };
    }

    const message = {
      tokens: validTokens,
      notification: {
        title: notification.title,
        body: notification.message,
        icon: notification.icon || '/default-notification-icon.png'
      },
      data: {
        notificationId: data.notificationId || '',
        type: data.type || 'general',
        eventId: data.eventId || '',
        courseId: data.courseId || '',
        groupId: data.groupId || '',
        userId: data.userId || '',
        clickAction: data.clickAction || 'FLUTTER_NOTIFICATION_CLICK',
        ...data.customData
      },
      android: {
        notification: {
          sound: 'default',
          priority: 'high',
          channelId: 'lms_notifications'
        },
        priority: 'high'
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: notification.badge || 1,
            'content-available': 1
          }
        }
      }
    };

    const messaging = getMessaging();
    const response = await messaging.sendMulticast(message);
    
    console.log(`Push notifications sent: ${response.successCount}/${validTokens.length} successful`);
    
    // Handle failed tokens
    const failedTokens = [];
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push({
            token: validTokens[idx],
            error: resp.error
          });
        }
      });
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      failedTokens
    };
  } catch (error) {
    console.error('Error sending multicast push notification:', error);
    return { success: false, error: 'MULTICAST_FAILED', message: error.message };
  }
};

// Send push notification to user by ID
const sendPushNotificationToUser = async (userId, notification, data = {}) => {
  try {
    const user = await User.findById(userId).select('deviceTokens notificationPreferences');
    
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has push notifications enabled
    if (!user.notificationPreferences?.pushNotifications) {
      console.log(`Push notifications disabled for user ${userId}`);
      return { success: true, message: 'Push notifications disabled for user' };
    }

    // Get active device tokens
    const activeTokens = user.deviceTokens
      ?.filter(device => device.isActive && device.token)
      ?.map(device => device.token) || [];

    if (activeTokens.length === 0) {
      console.log(`No active device tokens for user ${userId}`);
      return { success: true, message: 'No active device tokens' };
    }

    // Send to all user's devices
    const result = await sendMulticastPushNotification(activeTokens, notification, {
      ...data,
      userId: userId.toString()
    });

    // Clean up invalid tokens
    if (result.failedTokens && result.failedTokens.length > 0) {
      await cleanupInvalidTokens(userId, result.failedTokens);
    }

    return result;
  } catch (error) {
    console.error('Error sending push notification to user:', error);
    return { success: false, error: 'USER_NOTIFICATION_FAILED', message: error.message };
  }
};

// Send push notifications to multiple users
const sendPushNotificationToUsers = async (userIds, notification, data = {}) => {
  try {
    const results = [];
    
    // Process users in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const batchPromises = batch.map(userId => 
        sendPushNotificationToUser(userId, notification, data)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);
    }

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failureCount = results.length - successCount;

    return {
      success: true,
      totalUsers: userIds.length,
      successCount,
      failureCount,
      results
    };
  } catch (error) {
    console.error('Error sending push notifications to users:', error);
    return { success: false, error: 'BULK_NOTIFICATION_FAILED', message: error.message };
  }
};

// Clean up invalid device tokens
const cleanupInvalidTokens = async (userId, failedTokens) => {
  try {
    const invalidTokens = failedTokens
      .filter(failed => 
        failed.error?.code === 'messaging/registration-token-not-registered' ||
        failed.error?.code === 'messaging/invalid-registration-token'
      )
      .map(failed => failed.token);

    if (invalidTokens.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $pull: {
          deviceTokens: { token: { $in: invalidTokens } }
        }
      });
      
      console.log(`Cleaned up ${invalidTokens.length} invalid tokens for user ${userId}`);
    }
  } catch (error) {
    console.error('Error cleaning up invalid tokens:', error);
  }
};

// Validate Firebase configuration
const validateFirebaseConfig = () => {
  const app = initializeFirebase();
  return !!app;
};

// Subscribe device to topic
const subscribeToTopic = async (deviceToken, topic) => {
  try {
    const app = initializeFirebase();
    if (!app) {
      throw new Error('Firebase not initialized');
    }

    const messaging = getMessaging();
    await messaging.subscribeToTopic([deviceToken], topic);
    console.log(`Device subscribed to topic: ${topic}`);
    return { success: true };
  } catch (error) {
    console.error('Error subscribing to topic:', error);
    return { success: false, error: error.message };
  }
};

// Unsubscribe device from topic
const unsubscribeFromTopic = async (deviceToken, topic) => {
  try {
    const app = initializeFirebase();
    if (!app) {
      throw new Error('Firebase not initialized');
    }

    const messaging = getMessaging();
    await messaging.unsubscribeFromTopic([deviceToken], topic);
    console.log(`Device unsubscribed from topic: ${topic}`);
    return { success: true };
  } catch (error) {
    console.error('Error unsubscribing from topic:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  initializeFirebase,
  sendPushNotification,
  sendPushNotificationV2,
  sendMulticastPushNotification,
  sendPushNotificationToUser,
  sendPushNotificationToUsers,
  cleanupInvalidTokens,
  validateFirebaseConfig,
  subscribeToTopic,
  unsubscribeFromTopic
};

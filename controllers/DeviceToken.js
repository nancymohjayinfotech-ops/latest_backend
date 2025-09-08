const User = require('../models/User');
const { subscribeToTopic, unsubscribeFromTopic } = require('../services/firebaseService');

// Add or update device token
const addDeviceToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, platform, deviceId } = req.body;

    if (!token || !platform || !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Token, platform, and deviceId are required'
      });
    }

    // Validate platform
    const validPlatforms = ['ios', 'android', 'web'];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        message: 'Platform must be one of: ios, android, web'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if device already exists
    const existingDeviceIndex = user.deviceTokens.findIndex(
      device => device.deviceId === deviceId
    );

    if (existingDeviceIndex !== -1) {
      // Update existing device token
      user.deviceTokens[existingDeviceIndex] = {
        token,
        platform,
        deviceId,
        isActive: true,
        lastUsed: new Date()
      };
    } else {
      // Add new device token
      user.deviceTokens.push({
        token,
        platform,
        deviceId,
        isActive: true,
        lastUsed: new Date()
      });
    }

    await user.save();

    // Subscribe to general notifications topic
    try {
      await subscribeToTopic(token, `user_${userId}`);
      await subscribeToTopic(token, `role_${user.role}`);
    } catch (topicError) {
      console.error('Error subscribing to topics:', topicError);
      // Don't fail the request if topic subscription fails
    }

    res.status(200).json({
      success: true,
      message: 'Device token added successfully',
      data: {
        deviceId,
        platform,
        isActive: true
      }
    });
  } catch (error) {
    console.error('Error adding device token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add device token',
      error: error.message
    });
  }
};

// Remove device token
const removeDeviceToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.params;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find the device token to unsubscribe from topics
    const deviceToRemove = user.deviceTokens.find(
      device => device.deviceId === deviceId
    );

    if (deviceToRemove) {
      // Unsubscribe from topics
      try {
        await unsubscribeFromTopic(deviceToRemove.token, `user_${userId}`);
        await unsubscribeFromTopic(deviceToRemove.token, `role_${user.role}`);
      } catch (topicError) {
        console.error('Error unsubscribing from topics:', topicError);
        // Don't fail the request if topic unsubscription fails
      }
    }

    // Remove device token
    user.deviceTokens = user.deviceTokens.filter(
      device => device.deviceId !== deviceId
    );

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Device token removed successfully'
    });
  } catch (error) {
    console.error('Error removing device token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove device token',
      error: error.message
    });
  }
};

// Get user's device tokens
const getDeviceTokens = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('deviceTokens');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Return device info without exposing actual tokens
    const deviceInfo = user.deviceTokens.map(device => ({
      deviceId: device.deviceId,
      platform: device.platform,
      isActive: device.isActive,
      lastUsed: device.lastUsed
    }));

    res.status(200).json({
      success: true,
      data: {
        devices: deviceInfo,
        totalDevices: deviceInfo.length,
        activeDevices: deviceInfo.filter(d => d.isActive).length
      }
    });
  } catch (error) {
    console.error('Error getting device tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get device tokens',
      error: error.message
    });
  }
};

// Update device token status (activate/deactivate)
const updateDeviceTokenStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.params;
    const { isActive } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find and update device token
    const deviceIndex = user.deviceTokens.findIndex(
      device => device.deviceId === deviceId
    );

    if (deviceIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    const device = user.deviceTokens[deviceIndex];
    device.isActive = isActive;
    device.lastUsed = new Date();

    await user.save();

    // Handle topic subscriptions based on status
    try {
      if (isActive) {
        await subscribeToTopic(device.token, `user_${userId}`);
        await subscribeToTopic(device.token, `role_${user.role}`);
      } else {
        await unsubscribeFromTopic(device.token, `user_${userId}`);
        await unsubscribeFromTopic(device.token, `role_${user.role}`);
      }
    } catch (topicError) {
      console.error('Error managing topic subscriptions:', topicError);
      // Don't fail the request if topic management fails
    }

    res.status(200).json({
      success: true,
      message: `Device token ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        deviceId,
        isActive,
        lastUsed: device.lastUsed
      }
    });
  } catch (error) {
    console.error('Error updating device token status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update device token status',
      error: error.message
    });
  }
};

// Clean up inactive device tokens (admin function)
const cleanupInactiveTokens = async (req, res) => {
  try {
    const { daysInactive = 30 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysInactive));

    const result = await User.updateMany(
      {},
      {
        $pull: {
          deviceTokens: {
            $or: [
              { lastUsed: { $lt: cutoffDate } },
              { isActive: false, lastUsed: { $lt: cutoffDate } }
            ]
          }
        }
      }
    );

    res.status(200).json({
      success: true,
      message: `Cleaned up inactive device tokens`,
      data: {
        modifiedUsers: result.modifiedCount,
        daysInactive: parseInt(daysInactive)
      }
    });
  } catch (error) {
    console.error('Error cleaning up inactive tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup inactive tokens',
      error: error.message
    });
  }
};

// Test push notification to specific device
const testPushNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId, title, message } = req.body;

    if (!deviceId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Device ID, title, and message are required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // const device = user.deviceTokens.find(d => d.deviceId === deviceId && d.isActive);
    // if (!device) {
    //   return res.status(404).json({
    //     success: false,
    //     message: 'Active device not found'
    //   });
    // }

    const { sendPushNotification } = require('../services/firebaseService');
    
    const result = await sendPushNotification(deviceId  , {
      title,
      message,
      priority: 'high'
    }, {
      type: 'test',
      userId: userId.toString()
    });

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Test notification sent successfully',
        data: {
          messageId: result.messageId,
          deviceId
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send test notification',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error.message
    });
  }
};

module.exports = {
  addDeviceToken,
  removeDeviceToken,
  getDeviceTokens,
  updateDeviceTokenStatus,
  cleanupInactiveTokens,
  testPushNotification
};

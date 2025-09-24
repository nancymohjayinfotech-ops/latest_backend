const Notification = require('../models/Notification');
const Course = require('../models/Course');
const firebaseService = require('./firebaseService');

const sendNotification = async ({ recipients, type, title, message, sender = null, data = {},deviceToken }) => {
  // Loop through each recipient and create a notification document for them
  for (const userId of recipients) {
    try {
      const notificationPayload = {
        recipient: userId,
        type,
        title,
        message,
        sender,
        data,
      };
      
      // Use your static method to create the notification in the database
      await Notification.createNotification(notificationPayload);

      // Send push notification to the user
      await firebaseService.sendPushNotification(deviceToken, { title, message }, data);

    } catch (error) {
      console.error(`Failed to create notification for user ${userId}:`, error);
      // We can decide to continue or stop if one fails
    }
  }
};

module.exports = {
  sendNotification,
};
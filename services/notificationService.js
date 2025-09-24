const Notification = require('../models/Notification');
const Course = require('../models/Course');
const firebaseService = require('./firebaseService');
const User = require('../models/User');

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

      const user = await User.findById(userId).select('deviceTokens');
      
      // Use your static method to create the notification in the database
      await Notification.createNotification(notificationPayload);
      console.log(`Notification created for user ${userId}`);

      // Send push notification to the user
      if(user){
      await firebaseService.sendPushNotification(user.deviceTokens[0].token, { title, message }, data);
      console.log(`Push notification sent to user ${userId}`);
      }
  
    } catch (error) {
      console.error(`Failed to create notification for user ${userId}:`, error);
      // We can decide to continue or stop if one fails
    }
  }
};

module.exports = {
  sendNotification,
};
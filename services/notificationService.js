const Notification = require('../models/Notification');
const Course = require('../models/Course');
/**
 * Creates notifications in the database for one or more users.
 * This function only handles saving to the DB for in-app display.
 *
 * @param {Object} options - The notification options.
 * @param {string[]} options.recipients - An array of user IDs to create the notification for.
 * @param {string} options.type - The notification type (e.g., 'course_updated').
 * @param {string} options.title - The title of the notification.
 * @param {string} options.message - The main message content.
 * @param {string} [options.sender=null] - The user ID of the person who triggered the event. Null for system.
 * @param {Object} [options.data={}] - Additional data like courseId, eventId, etc.
 */
const sendNotification = async ({ recipients, type, title, message, sender = null, data = {} }) => {
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

    } catch (error) {
      console.error(`Failed to create notification for user ${userId}:`, error);
      // We can decide to continue or stop if one fails
    }
  }
};

module.exports = {
  sendNotification,
};
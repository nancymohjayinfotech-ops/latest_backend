const express = require('express');
const router = express.Router();
const {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  getNotificationStats,
  updateNotificationPreferences,
  getNotificationPreferences
} = require('../controllers/Notification');
const { protect, authorize } = require('../middleware/mongoAuth');

// User notification routes
router.get('/', protect, authorize('user'), getUserNotifications);
router.get('/unread-count', protect, authorize('user'), getUnreadCount);
router.get('/preferences', protect, authorize('user'), getNotificationPreferences);
router.put('/preferences', protect, authorize('user'), updateNotificationPreferences);

// Mark notifications as read
router.patch('/:notificationId/read', protect, authorize('user'), markAsRead);
router.patch('/mark-multiple-read', protect, authorize('user'), markMultipleAsRead);
router.patch('/mark-all-read', protect, authorize('user'), markAllAsRead);

// Delete notification
router.delete('/:notificationId', protect, authorize('user'), deleteNotification);

// Admin routes
router.post('/create', protect, authorize('admin'), createNotification);
router.get('/stats', protect, authorize('admin'), getNotificationStats);

module.exports = router;

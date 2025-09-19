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
router.get('/', protect, authorize('student', 'instructor', 'event','admin'), getUserNotifications);
router.get('/unread-count', protect, authorize('student', 'instructor', 'event','admin'), getUnreadCount);
router.get('/preferences', protect, authorize('student', 'instructor', 'event','admin'), getNotificationPreferences);
router.put('/preferences', protect, authorize('student', 'instructor', 'event','admin'), updateNotificationPreferences);

// Mark notifications as read
router.patch('/:notificationId/read', protect, authorize('student', 'instructor', 'event','admin'), markAsRead);
router.patch('/mark-multiple-read', protect, authorize('student', 'instructor', 'event','admin'), markMultipleAsRead);
router.patch('/mark-all-read', protect, authorize('student', 'instructor', 'event','admin'), markAllAsRead);

// Delete notification
router.delete('/:notificationId', protect, authorize('student', 'instructor', 'event','admin'), deleteNotification);

// Admin routes
router.post('/create', protect, authorize('admin', 'instructor', 'event'), createNotification);
router.get('/stats', protect, authorize('admin', 'instructor', 'event'), getNotificationStats);

module.exports = router;

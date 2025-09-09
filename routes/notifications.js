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
router.get('/', protect, authorize('student', 'instructor', 'event'), getUserNotifications);
router.get('/unread-count', protect, authorize('student', 'instructor', 'event'), getUnreadCount);
router.get('/preferences', protect, authorize('student', 'instructor', 'event'), getNotificationPreferences);
router.put('/preferences', protect, authorize('student', 'instructor', 'event'), updateNotificationPreferences);

// Mark notifications as read
router.patch('/:notificationId/read', protect, authorize('student', 'instructor', 'event'), markAsRead);
router.patch('/mark-multiple-read', protect, authorize('student', 'instructor', 'event'), markMultipleAsRead);
router.patch('/mark-all-read', protect, authorize('student', 'instructor', 'event'), markAllAsRead);

// Delete notification
router.delete('/:notificationId', protect, authorize('student', 'instructor', 'event'), deleteNotification);

// Admin routes
router.post('/create', protect, authorize('admin', 'instructor', 'event'), createNotification);
router.get('/stats', protect, authorize('admin', 'instructor', 'event'), getNotificationStats);

module.exports = router;

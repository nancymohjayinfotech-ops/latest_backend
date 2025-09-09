const express = require('express');
const router = express.Router();
const {
  addDeviceToken,
  removeDeviceToken,
  getDeviceTokens,
  updateDeviceTokenStatus,
  cleanupInactiveTokens,
  testPushNotification,
  debugNotificationDelivery
} = require('../controllers/DeviceToken');
const { protect, authorize } = require('../middleware/mongoAuth');

// User device token routes
router.post('/register', protect, addDeviceToken);
router.delete('/:deviceId', protect, removeDeviceToken);
router.get('/', protect, getDeviceTokens);
router.patch('/:deviceId/status', protect, updateDeviceTokenStatus);
router.post('/test', protect, testPushNotification);
router.post('/debug', protect, debugNotificationDelivery);

// Admin routes
router.delete('/cleanup/inactive', protect, authorize('admin'), cleanupInactiveTokens);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  createOrUpdateContent,
  getContentByType,
  getAllContent,
  deleteContent
} = require('../controllers/Content');
const { protect, authorize } = require('../middleware/mongoAuth');

// Content routes
router.route('/')
  .get(getAllContent)
  .post(protect,authorize('admin'), createOrUpdateContent);

router.route('/:type')
  .get(getContentByType)
  .delete(protect,authorize('admin'), deleteContent);

module.exports = router;

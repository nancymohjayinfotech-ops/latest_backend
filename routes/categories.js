const express = require('express');
const router = express.Router();
const {
  createCategory,
  getAllCategories,
  getAllCategoriesWithPagination,
  getAllCategoriesWithCounts,
  getCategoryById,
  deleteCategory,
} = require('../controllers/Category');
const { protect, authorize } = require('../middleware/mongoAuth');

router.route('/')
  .get(getAllCategories)
  .post(protect,authorize('admin'), createCategory);
router.route('/paginated')
  .get(getAllCategoriesWithPagination);
router.route('/with-counts')
  .get(getAllCategoriesWithCounts);

router.route('/:id')
  .get(getCategoryById)
  .delete(protect,authorize('admin'), deleteCategory);

module.exports = router;

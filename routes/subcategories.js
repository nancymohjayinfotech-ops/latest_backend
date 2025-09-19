const express = require('express');
const router = express.Router();
const {
  createSubcategory,
  getSubcategoriesByCategoryId,
  getSubcategoriesWithPagination,
  getSubcategoryById,
  deleteSubcategory
} = require('../controllers/Subcategory');
const { protect, authorize } = require('../middleware/mongoAuth');

router.route('/')
  .post(protect, authorize('admin'), createSubcategory);

// Admin Routes  
router.route('/paginated')
.get(getSubcategoriesWithPagination);

router.route('/id/:id')
  .get(getSubcategoryById)
  .delete(protect, authorize('admin'), deleteSubcategory);

router.route('/category/:categoryId')
  .get(getSubcategoriesByCategoryId);



module.exports = router;

const Subcategory = require('../models/Subcategory');
const Category = require('../models/Category');
const mongoose = require('mongoose');
const slugify = require('slugify');

// Create a new subcategory
const createSubcategory = async (req, res) => {
  try {
    const { categoryId } = req.body;
    
    const isValidObjectId = mongoose.Types.ObjectId.isValid(categoryId);
    
    const category = isValidObjectId ? await Category.findById(categoryId) : null;
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    if (req.body.id) {
      const subcategoryId = req.body.id;
      const subcategory = await Subcategory.findById(subcategoryId);
      
      if (!subcategory) {
        return res.status(404).json({
          success: false,
          message: 'Subcategory not found'
        });
      }
      
      Object.assign(subcategory, req.body);
      
      if (req.body.name) {
        subcategory.slug = slugify(req.body.name, { lower: true, strict: true });
      }
      
      await subcategory.save();
      
      return res.status(200).json({
        success: true,
        message: 'Subcategory updated successfully',
        subcategory
      });
    } else {
      const subcategory = new Subcategory({
        ...req.body,
        categoryId: category._id,
        isActive: true
      });
      
      // Ensure slug is generated if name is provided
      if (req.body.name) {
        subcategory.slug = slugify(req.body.name, { lower: true, strict: true });
      }
      
      await subcategory.save();
      
      return res.status(201).json({
        success: true,
        message: 'Subcategory created successfully',
        subcategory
      });
    }
  } catch (error) {
    console.error('Error creating/updating subcategory:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating/updating subcategory',
      error: error.message
    });
  }
};

const getSubcategoriesByCategoryId = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    const isValidObjectId = mongoose.Types.ObjectId.isValid(categoryId);
    
    if (!isValidObjectId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format'
      });
    }
    
    const subcategories = await Subcategory.find({
      categoryId,
      isActive: true
    }).sort({ order: 1 });
    
    return res.status(200).json({
      success: true,
      message: 'Subcategories fetched successfully',
      subcategories
    });
  } catch (error) {
    console.error('Error getting subcategories:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching subcategories',
      error: error.message
    });
  }
};

const getSubcategoriesWithPagination = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const skip = (page - 1) * limit;
    
    const totalCount = await Subcategory.countDocuments({
      isActive: true
    });
    
    const subcategories = await Subcategory.find({
      isActive: true
    })
    .populate('categoryId', 'name')
      .sort({ order: 1 })
      .skip(skip)
      .limit(limit);
    
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return res.status(200).json({
      success: true,
      message: 'Subcategories fetched successfully',
      subcategories,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    console.error('Error getting subcategories with pagination:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching subcategories',
      error: error.message
    });
  }
};

const getSubcategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);
    
    if (!isValidObjectId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subcategory ID format'
      });
    } 
    const subcategory = await Subcategory.findById(id);
    
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Subcategory fetched successfully',
      subcategory
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching subcategory',
      error: error.message
    });
  }
};

const deleteSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);
    
    if (!isValidObjectId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subcategory ID format'
      });
    }
    
    const subcategory = await Subcategory.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Subcategory deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error deleting subcategory',
      error: error.message
    });
  }
};

module.exports = {
  createSubcategory,
  getSubcategoriesByCategoryId,
  getSubcategoriesWithPagination,
  getSubcategoryById,
  deleteSubcategory
};

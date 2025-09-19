const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Course = require('../models/Course');
const mongoose = require('mongoose');

// Create a new category
const createCategory = async (req,res) => {
  try {
    if(req.body.id){
      const category = await Category.findById(req.body.id);
      if(!category){
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }
      Object.assign(category, req.body);
      await category.save();
      return res.status(200).json({
        success: true,
        message: 'Category updated successfully',
        category
      });
    }
    else{
      const category = new Category(req.body);
      await category.save();
      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        category
      });
    }
    
  } catch (error) {
    console.error('Error creating category:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating category',
      error: error.message
    });
  }
};

// Get all categories
const getAllCategories = async (req,res) => {
  try {
    const categories = await Category.find({isActive: true}).sort({ order: 1 });
    res.status(200).json({
      success: true,
      message: 'Categories fetched successfully',
      categories
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting categories',
      error: error.message
    });
  }
};

// Get all categories with pagination
const getAllCategoriesWithPagination = async (req, res) => {
  try {
    // Extract page and limit from query parameters, with defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Calculate skip value for pagination
    const skip = (page - 1) * limit;
    
    // Get total count for pagination metadata
    const totalCount = await Category.countDocuments();
    
    // Fetch categories with pagination
    const categories = await Category.find({isActive: true})
      .sort({ order: 1 })
      .skip(skip)
      .limit(limit);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    res.status(200).json({
      success: true,
      message: 'Categories fetched successfully',
      categories,
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
    console.error('Error getting categories with pagination:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
};

// Get category by ID or slug
const getCategoryById = async (req,res) => {
  try {
    let category;
    const { id } = req.params;
    
    // Check if the id is a valid MongoDB ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);
    
    if (isValidObjectId) {
      category = await Category.findById(id);
    }
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Category fetched successfully',
      category
    });
  } catch (error) {
    console.error('Error getting category:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching category',
      error: error.message
    });
  }
};

// Delete category
const deleteCategory = async (req,res) => {
  try {
    await Category.findByIdAndUpdate(req.params.id,{
      isActive: false
    });
    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting category',
      error: error.message
    });
  }
};

// Get all categories with subcategory and course counts
const getAllCategoriesWithCounts = async (req, res) => {
  try {
    const categories = await Category.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $lookup: {
          from: 'subcategories',
          localField: '_id',
          foreignField: 'categoryId',
          as: 'subcategories'
        }
      },
      {
        $lookup: {
          from: 'courses',
          localField: '_id',
          foreignField: 'category',
          as: 'courses'
        }
      },
      {
        $addFields: {
          subcategoryCount: {
            $size: {
              $filter: {
                input: '$subcategories',
                cond: { $eq: ['$$this.isActive', true] }
              }
            }
          },
          courseCount: {
            $size: {
              $filter: {
                input: '$courses',
                cond: { $eq: ['$$this.published', true] }
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          slug: 1,
          icon: 1,
          color: 1,
          order: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          subcategoryCount: 1,
          courseCount: 1
        }
      },
      {
        $sort: { order: 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      message: 'Categories with counts fetched successfully',
      categories
    });
  } catch (error) {
    console.error('Error getting categories with counts:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching categories with counts',
      error: error.message
    });
  }
};

module.exports = {
  createCategory,
  getAllCategories,
  getAllCategoriesWithPagination,
  getAllCategoriesWithCounts,
  getCategoryById,
  deleteCategory,
};

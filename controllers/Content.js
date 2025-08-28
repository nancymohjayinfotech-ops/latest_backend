const Content = require('../models/Content');

// Create or update content
const createOrUpdateContent = async (req,res) => {
  try {
    const content = await Content.findOneAndUpdate(
      { type: req.body.type },
      {
        title: req.body.title,
        type: req.body.type,
        content: req.body.content
      },
      { 
        upsert: true, 
        new: true, 
        runValidators: true 
      }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Content created/updated successfully',
    });
  } catch (error) {
    console.error('Error creating/updating content:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating/updating content',
      error: error.message
    });
  }
};

// Get content by type
const getContentByType = async (req,res) => {
  try {
    const content = await Content.findOne({ type: req.params.type });

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Content fetched successfully',
      content
    });
  } catch (error) {
    console.error('Error getting content by type:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting content by type',
      error: error.message
    });
  }
};

// Get all content
const getAllContent = async (req,res) => {
  try {
    const content = await Content.find();
    return res.status(200).json({
      success: true,
      message: 'Content fetched successfully',
      content
    });
  } catch (error) {
    console.error('Error getting all content:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting all content',
      error: error.message
    });
  }
};

// Delete content
const deleteContent = async (req,res) => {
  try {
    const content = await Content.findOne({ type: req.params.type });
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }
    await Content.findOneAndDelete({ type: req.params.type });
    return res.status(200).json({
      success: true,
      message: 'Content deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting content:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting content',
      error: error.message
    });
  }
};

module.exports = {
  createOrUpdateContent,
  getContentByType,
  getAllContent,
  deleteContent
};

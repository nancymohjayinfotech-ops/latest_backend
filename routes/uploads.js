const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/mongoAuth');
const { uploadSingle, uploadMultiple, getFileInfo, deleteFile } = require('../middleware/uploadMiddleware');
const User = require('../models/User');
const path = require('path');

// @desc    Upload single file (profile image or general media)
// @route   POST /api/uploads/single
// @access  Private
router.post('/single', protect, uploadSingle('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const uploadType = req.body.uploadType || req.query.uploadType || 'media';
    const fileInfo = getFileInfo(req.file);

    // If it's a profile upload, update user's avatar
    if (uploadType === 'profile') {
      try {
        const user = await User.findById(req.user.id);
        
        // Delete old avatar if exists
        if (user.avatar && user.avatar !== fileInfo.url) {
          const oldAvatarPath = path.join(__dirname, '..', user.avatar);
          deleteFile(oldAvatarPath);
        }

        // Update user avatar
        user.avatar = fileInfo.url;
        await user.save();

        return res.status(200).json({
          success: true,
          message: 'Profile image uploaded successfully',
          data: {
            file: fileInfo,
            user: {
              id: user._id,
              name: user.name,
              email: user.email,
              avatar: user.avatar
            }
          }
        });
      } catch (error) {
        // If user update fails, delete the uploaded file
        deleteFile(req.file.path);
        console.error('Profile update error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to update profile image'
        });
      }
    }

    // For other upload types, just return file info
    res.status(200).json({
      success: true,
      message: `${uploadType.charAt(0).toUpperCase() + uploadType.slice(1)} file uploaded successfully`,
      data: {
        file: fileInfo,
        uploadType: uploadType
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'File upload failed'
    });
  }
});

// @desc    Upload multiple files
// @route   POST /api/uploads/multiple
// @access  Private
router.post('/multiple', protect, uploadMultiple('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const uploadType = req.body.uploadType || req.query.uploadType || 'media';
    const filesInfo = req.files.map(file => getFileInfo(file));

    res.status(200).json({
      success: true,
      message: `${req.files.length} file(s) uploaded successfully`,
      data: {
        files: filesInfo,
        uploadType: uploadType,
        count: req.files.length
      }
    });

  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Files upload failed'
    });
  }
});

// @desc    Upload profile image (dedicated endpoint)
// @route   POST /api/uploads/profile
// @access  Private
router.post('/profile', protect, (req, res, next) => {
  req.body.uploadType = 'profile';
  next();
}, uploadSingle('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No profile image uploaded'
      });
    }

    const fileInfo = getFileInfo(req.file);

    const user = await User.findById(req.user.id);
    
    // Delete old avatar if exists
    if (user.avatar && user.avatar !== fileInfo.url) {
      const oldAvatarPath = path.join(__dirname, '..', user.avatar);
      deleteFile(oldAvatarPath);
    }

    // Update user avatar
    user.avatar = fileInfo.url;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile image updated successfully',
      data: {
        file: fileInfo,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar
        }
      }
    });

  } catch (error) {
    // If user update fails, delete the uploaded file
    if (req.file) {
      deleteFile(req.file.path);
    }
    console.error('Profile upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile image'
    });
  }
});

router.post('/course', protect, (req, res, next) => {
  // Initialize req.body if undefined and set upload type
  if (!req.body) req.body = {};
  req.body.uploadType = 'course';
  next();
}, uploadMultiple('materials', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No course materials uploaded'
      });
    }

    const filesInfo = req.files.map(file => getFileInfo(file));

    res.status(200).json({
      success: true,
      message: `${req.files.length} course material(s) uploaded successfully`,
      data: {
        files: filesInfo,
        uploadType: 'course',
        count: req.files.length
      }
    });

  } catch (error) {
    console.error('Course upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload course materials'
    });
  }
});

// @desc    Upload assessment files
// @route   POST /api/uploads/assessment
// @access  Private
router.post('/assessment', protect, (req, res, next) => {
  // Initialize req.body if undefined and set upload type
  if (!req.body) req.body = {};
  req.body.uploadType = 'assessment';
  next();
}, uploadMultiple('assessments', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No assessment files uploaded'
      });
    }

    const filesInfo = req.files.map(file => getFileInfo(file));

    res.status(200).json({
      success: true,
      message: `${req.files.length} assessment file(s) uploaded successfully`,
      data: {
        files: filesInfo,
        uploadType: 'assessment',
        count: req.files.length
      }
    });

  } catch (error) {
    console.error('Assessment upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload assessment files'
    });
  }
});

// @desc    Delete uploaded file
// @route   DELETE /api/uploads/file
// @access  Private
router.delete('/file', protect, async (req, res) => {
  try {
    const { filePath, fileName } = req.body;

    if (!filePath && !fileName) {
      return res.status(400).json({
        success: false,
        message: 'File path or file name is required'
      });
    }

    let fullPath;
    if (filePath) {
      fullPath = path.join(__dirname, '..', filePath);
    } else {
      // If only fileName is provided, search in uploads directory
      fullPath = path.join(__dirname, '../uploads', fileName);
    }

    const deleted = deleteFile(fullPath);

    if (deleted) {
      res.status(200).json({
        success: true,
        message: 'File deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found or already deleted'
      });
    }

  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
});

// @desc    Get upload info/limits
// @route   GET /api/uploads/info
// @access  Private
router.get('/info', protect, (req, res) => {
  try {
    const uploadInfo = {
      allowedTypes: {
        profile: {
          extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
          maxSize: '5MB',
          maxFiles: 1
        },
        course: {
          extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.zip', '.mp4', '.avi', '.mov', '.wmv', '.doc', '.docx'],
          maxSize: '100MB',
          maxFiles: 20
        },
        assessment: {
          extensions: ['.pdf', '.zip', '.doc', '.docx', '.jpg', '.jpeg', '.png'],
          maxSize: '50MB',
          maxFiles: 5
        },
        document: {
          extensions: ['.pdf', '.zip', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'],
          maxSize: '50MB',
          maxFiles: 10
        },
        media: {
          extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.mp4', '.avi', '.mov', '.wmv', '.webm', '.mp3', '.wav', '.ogg', '.m4a', '.pdf', '.zip'],
          maxSize: '200MB',
          maxFiles: 10
        }
      },
      endpoints: {
        single: 'POST /api/uploads/single',
        multiple: 'POST /api/uploads/multiple',
        profile: 'POST /api/uploads/profile',
        course: 'POST /api/uploads/course',
        assessment: 'POST /api/uploads/assessment',
        delete: 'DELETE /api/uploads/file',
        info: 'GET /api/uploads/info'
      }
    };

    res.status(200).json({
      success: true,
      message: 'Upload information retrieved successfully',
      data: uploadInfo
    });

  } catch (error) {
    console.error('Info retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve upload information'
    });
  }
});

module.exports = router;

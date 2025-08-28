const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const createUploadDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;
    
    // Get uploadType from various sources, including URL path
    let uploadType = req.body?.uploadType || req.query?.uploadType || req.uploadType;
    
    // If no uploadType found, try to determine from URL path
    if (!uploadType && req.url) {
      if (req.url.includes('/profile')) {
        uploadType = 'profile';
      } else if (req.url.includes('/course')) {
        uploadType = 'course';
      } else if (req.url.includes('/assessment')) {
        uploadType = 'assessment';
      } else if (req.url.includes('/event')) {
        uploadType = 'event';
      }
    }
    // Determine upload path based on upload type
    switch (uploadType) {
      case 'profile':
        uploadPath = path.join(__dirname, '../uploads/profiles');
        break;
      case 'course':
        uploadPath = path.join(__dirname, '../uploads/courses');
        break;
      case 'assessment':
        uploadPath = path.join(__dirname, '../uploads/assessments');
        break;
      case 'event':
        uploadPath = path.join(__dirname, '../uploads/events');
        break;
      case 'document':
        uploadPath = path.join(__dirname, '../uploads/documents');
        break;
      case 'media':
        uploadPath = path.join(__dirname, '../uploads/media');
        break;
      default:
        uploadPath = path.join(__dirname, '../uploads/general');
    }
    
    createUploadDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const fileName = file.fieldname + '-' + uniqueSuffix + fileExtension;
    cb(null, fileName);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  const uploadType = req.body.uploadType || req.query.uploadType;
  
  // Define allowed file types for different upload types
  const allowedTypes = {
    profile: {
      mimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    },
    course: {
      mimeTypes: [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'application/zip', 'application/x-zip-compressed',
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ],
      extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.zip', '.mp4', '.avi', '.mov', '.wmv', '.doc', '.docx']
    },
    assessment: {
      mimeTypes: [
        'application/pdf', 'application/zip', 'application/x-zip-compressed',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg', 'image/jpg', 'image/png'
      ],
      extensions: ['.pdf', '.zip', '.doc', '.docx', '.jpg', '.jpeg', '.png']
    },
    event: {
      mimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    },
    document: {
      mimeTypes: [
        'application/pdf', 'application/zip', 'application/x-zip-compressed',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv'
      ],
      extensions: ['.pdf', '.zip', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv']
    },
    media: {
      mimeTypes: [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm',
        'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a',
        'application/pdf', 'application/zip', 'application/x-zip-compressed'
      ],
      extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.mp4', '.avi', '.mov', '.wmv', '.webm', '.mp3', '.wav', '.ogg', '.m4a', '.pdf', '.zip']
    }
  };

  // Default to media type if no specific type is provided
  const typeConfig = allowedTypes[uploadType] || allowedTypes.media;
  const fileExtension = path.extname(file.originalname).toLowerCase();

  // Check both MIME type and file extension
  const isMimeTypeAllowed = typeConfig.mimeTypes.includes(file.mimetype);
  const isExtensionAllowed = typeConfig.extensions.includes(fileExtension);

  if (isMimeTypeAllowed && isExtensionAllowed) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed for ${uploadType} upload. Allowed types: ${typeConfig.extensions.join(', ')}`), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: (req, file, cb) => {
      const uploadType = req.body.uploadType || req.query.uploadType;
      
      // Define file size limits (in bytes)
      const sizeLimits = {
        profile: 5 * 1024 * 1024,      // 5MB for profile images
        course: 100 * 1024 * 1024,     // 100MB for course materials
        assessment: 50 * 1024 * 1024,  // 50MB for assessments
        event: 10 * 1024 * 1024,       // 10MB for event images
        document: 50 * 1024 * 1024,    // 50MB for documents
        media: 200 * 1024 * 1024       // 200MB for general media
      };
      
      const limit = sizeLimits[uploadType] || sizeLimits.media;
      cb(null, limit);
    }
  }
});

// Middleware for single file upload
exports.uploadSingle = (fieldName = 'file') => {
  return (req, res, next) => {
    const singleUpload = upload.single(fieldName);
    
    singleUpload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              message: 'File size too large. Please check the size limits for your upload type.'
            });
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
              success: false,
              message: 'Unexpected field name. Please use the correct field name for file upload.'
            });
          }
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed'
        });
      }
      next();
    });
  };
};

// Middleware for multiple files upload
exports.uploadMultiple = (fieldName = 'files', maxCount = 10) => {
  return (req, res, next) => {
    const multipleUpload = upload.array(fieldName, maxCount);
    
    multipleUpload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              message: 'One or more files exceed the size limit.'
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              success: false,
              message: `Too many files. Maximum allowed: ${maxCount}`
            });
          }
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed'
        });
      }
      next();
    });
  };
};

// Middleware for mixed file uploads (different field names)
exports.uploadFields = (fields) => {
  return (req, res, next) => {
    const fieldsUpload = upload.fields(fields);
    
    fieldsUpload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              message: 'One or more files exceed the size limit.'
            });
          }
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed'
        });
      }
      next();
    });
  };
};

// Utility function to delete uploaded files
exports.deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

// Utility function to get file info
exports.getFileInfo = (file) => {
  if (!file) return null;
  
  return {
    filename: file.filename,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path,
    destination: file.destination,
    url: `/uploads/${path.basename(file.destination)}/${file.filename}`
  };
};

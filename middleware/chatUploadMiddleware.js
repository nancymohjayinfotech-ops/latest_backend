const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create chat uploads directory if it doesn't exist
const createChatUploadDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure storage for chat media
const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/chat');
    createChatUploadDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const fileName = 'chat-' + uniqueSuffix + fileExtension;
    cb(null, fileName);
  }
});

// File filter for chat media
const chatFileFilter = (req, file, cb) => {
  // Define allowed file types for chat
  const allowedTypes = {
    mimeTypes: [
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Videos
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm', 'video/quicktime',
      // Audio
      'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mpeg',
      // Documents
      'application/pdf', 'application/zip', 'application/x-zip-compressed',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv'
    ],
    extensions: [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
      '.mp4', '.avi', '.mov', '.wmv', '.webm', '.qt',
      '.mp3', '.wav', '.ogg', '.m4a',
      '.pdf', '.zip', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'
    ]
  };

  const fileExtension = path.extname(file.originalname).toLowerCase();

  // Check both MIME type and file extension
  const isMimeTypeAllowed = allowedTypes.mimeTypes.includes(file.mimetype);
  const isExtensionAllowed = allowedTypes.extensions.includes(fileExtension);

  if (isMimeTypeAllowed && isExtensionAllowed) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed for chat upload. Allowed types: ${allowedTypes.extensions.join(', ')}`), false);
  }
};

// Configure multer for chat
const chatUpload = multer({
  storage: chatStorage,
  fileFilter: chatFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for chat files
    files: 5 // Maximum 5 files at once
  }
});

// Middleware for single chat file upload
exports.uploadChatFile = (fieldName = 'file') => {
  return (req, res, next) => {
    const singleUpload = chatUpload.single(fieldName);
    
    singleUpload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              message: 'File size too large. Maximum allowed size is 50MB.'
            });
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
              success: false,
              message: 'Unexpected field name. Please use "file" as the field name.'
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

// Middleware for multiple chat files upload
exports.uploadChatFiles = (fieldName = 'files', maxCount = 5) => {
  return (req, res, next) => {
    const multipleUpload = chatUpload.array(fieldName, maxCount);
    
    multipleUpload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              message: 'One or more files exceed the 50MB size limit.'
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

// Utility function to determine message type from file
exports.getMessageTypeFromFile = (file) => {
  if (!file) return 'text';
  
  const mimetype = file.mimetype.toLowerCase();
  
  if (mimetype.startsWith('image/')) {
    return 'image';
  } else if (mimetype.startsWith('video/')) {
    return 'video';
  } else if (mimetype.startsWith('audio/')) {
    return 'audio';
  } else {
    return 'document';
  }
};

// Utility function to get chat file info
exports.getChatFileInfo = (file) => {
  if (!file) return null;
  
  return {
    filename: file.filename,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path,
    url: `/uploads/chat/${file.filename}`
  };
};

// Utility function to delete chat file
exports.deleteChatFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting chat file:', error);
    return false;
  }
};

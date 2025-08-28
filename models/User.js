const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: false
  },
  phoneNumber: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    trim: true
  },
  password: {
    type: String,
    required: false,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'instructor', 'student','event'],
    default: 'student'
  },
  googleId: {
    type: String,
    default: null
  },
  avatar: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  password: {
    type: String,
    default: ''
  },
  dob: {
    type: String,
    default: ''
  },
  state: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  college: {
    type: String,
    default: ''
  },
  studentId: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  favoriteCourses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  enrolledCourses: [{
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true
    },
    enrolledAt: {
      type: Date,
      default: Date.now
    },
    lastAccessed: {
      type: Date,
      default: Date.now
    },
    progress: {
      completedSections: [{
        type: mongoose.Schema.Types.ObjectId
      }],
      completedVideos: [{
        type: mongoose.Schema.Types.ObjectId
      }],
      totalTimeSpent: {
        type: Number,
        default: 0 // in seconds
      }
    }
  }],
  cart: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  otpHash: {
    type: String,
    default: null
  },
  otpExpiry: {
    type: Date,
    default: null
  },
  otpAttempts: {
    type: Number,
    default: 0
  },
  otpAttemptsExpiry: {
    type: Date,
    default: null
  },
  sessionToken: {
    type: String,
    default: null
  },
  refreshToken: {
    type: String,
    default: null
  },
  refreshTokenExpiry: {
    type: Date,
    default: null
  },
  interests: {
    categories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    }],
    subcategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subcategory'
    }]
  },
  isInterestsSet: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);

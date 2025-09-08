const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: false,
    default: ''
  },
  phoneNumber: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    trim: true
  },
  skills: [{
    type: String,
    trim: true
  }],
  specializations:{
    type:String,
    trim:true
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
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Instructor availability slots
  availabilitySlots: [{
    startTime: {
      type: String, // Format: "HH:MM" (24-hour format)
      required: function() { return this.role === 'instructor'; }
    },
    endTime: {
      type: String, // Format: "HH:MM" (24-hour format)
      required: function() { return this.role === 'instructor'; }
    },
    dayOfWeek: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      required: function() { return this.role === 'instructor'; }
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  // Push notification device tokens
  deviceTokens: [{
    token: {
      type: String,
      required: true
    },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web'],
      required: true
    },
    deviceId: {
      type: String,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  }],
  // Notification preferences
  notificationPreferences: {
    session: {
      type: Boolean,
      default: true
    },
    messages: {
      type: Boolean,
      default: true
    },
    feedBack: {
      type: Boolean,
      default: true
    },
    newEnrollments: {
      type: Boolean,
      default: true
    },
    reviews: {
      type: Boolean,
      default: true
    },
    groupMessages: {
      type: Boolean,
      default: true
    },
    groupMemberAdded: {
      type: Boolean,
      default: true
    },
    pushNotifications: {
      type: Boolean,
      default: true
    }
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'declined'],
        default: 'pending'
    },
    requestedAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date
    }
});

const eventSchema = new mongoose.Schema({
    category: {
        type: String,
        required: [true, 'Event category is required'],
        trim: true
    },
    title: {
        type: String,
        required: [true, 'Event title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
        type: String,
        required: [true, 'Event description is required'],
        trim: true
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true,
        trim: true
    },
    contact_phone: {
        type: String,
        trim: true
    },
    contact_email: {
        type: String,
        trim: true
    },
    location: {
        type: String,
        required: [true, 'Event location is required'],
        trim: true
    },
    eventType: {
        type: String,
        enum: ['online', 'offline','hybrid'],
        default: 'offline'
    },
    startDate: {
        type: Date,
        required: true
    },
    startTime: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: 'Start time must be in HH:MM format'
        }
    },
    endDate: {
        type: Date,
        required: true
    },
    endTime: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: 'End time must be in HH:MM format'
        }
    },
    registrationDeadline: {
        type: Date,
        required: true
    },
    maxParticipants: {
        type: Number,
        default: 100
    },
    price: {
        type: Number,
        default: null
    },
    tags: [{
        type: String,
        trim: true
    }],
    images: [{
        type: String,
        trim: true
    }],
    videos: [{
        type: String,
        trim: true
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    deletedAt: {
        type: Date,
        default: null
    },
    enrollments: [enrollmentSchema]
}, {
    timestamps: true
});

// Generate slug from title before saving
eventSchema.pre('save', function(next) {
    if (this.isModified('title')) {
        this.slug = this.title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');
    }
    next();
});

module.exports = mongoose.model('Event', eventSchema);

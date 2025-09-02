const Event = require('../models/Event');
const fs = require('fs');
const path = require('path');

// Create Event (User/Admin)
const createEvent = async (req, res) => {
    try {
        const { 
            category, title, description, location, eventType, 
            startDate, startTime, endDate, endTime, registrationDeadline, maxParticipants, 
            price, tags, videos 
        } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!category || !title || !description || !location || !startDate || !startTime || !endDate || !endTime || !registrationDeadline) {
            return res.status(400).json({
                success: false,
                message: 'Category, title, description, location, start date, start time, end date, end time, and registration deadline are required'
            });
        }

        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        const regDeadline = new Date(registrationDeadline);
        
        if (start >= end) {
            return res.status(400).json({
                success: false,
                message: 'End date must be after start date'
            });
        }
        
        if (regDeadline >= start) {
            return res.status(400).json({
                success: false,
                message: 'Registration deadline must be before start date'
            });
        }

        // Handle uploaded images
        let images = [];
        if (req.files) {
            images = req.files.map(file => file.path.replace(/\\\\/g, '/'));
        }

        // Parse videos if it's a string
        let videoArray = [];
        if (videos) {
            try {
                videoArray = typeof videos === 'string' ? JSON.parse(videos) : videos;
                if (!Array.isArray(videoArray)) {
                    videoArray = [videos];
                }
            } catch (error) {
                videoArray = [videos];
            }
        }

        // Parse tags if it's a string
        let tagArray = [];
        if (tags) {
            try {
                tagArray = typeof tags === 'string' ? JSON.parse(tags) : tags;
                if (!Array.isArray(tagArray)) {
                    tagArray = [tags];
                }
            } catch (error) {
                tagArray = [tags];
            }
        }

        // Create event
        const event = new Event({
            category,
            title,
            description,
            location,
            eventType: eventType || 'offline',
            startDate: start,
            startTime,
            endDate: end,
            endTime,
            registrationDeadline: regDeadline,
            maxParticipants: maxParticipants || 100,
            price: price || null,
            tags: tagArray,
            images,
            videos: videoArray,
            createdBy: userId
        });

        await event.save();

        res.status(201).json({
            success: true,
            message: 'Event created successfully',
            data: event
        });

    } catch (error) {
        console.error('Error creating event:', error);
        
        // Clean up uploaded files on error
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'An event with this title already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create event'
        });
    }
};

// Get Event by Slug
const getEventBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const event = await Event.findOne({ slug: slug, isActive: true })
            .populate('createdBy', 'name email')
            .populate('enrollments.student', 'name email');

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Calculate participant counts
        const participantStats = {
            totalEnrollments: event.enrollments.length,
            approvedParticipants: event.enrollments.filter(e => e.status === 'approved').length,
            pendingRequests: event.enrollments.filter(e => e.status === 'pending').length,
            declinedRequests: event.enrollments.filter(e => e.status === 'declined').length,
            availableSpots: event.maxParticipants - event.enrollments.filter(e => e.status === 'approved').length
        };

        res.status(200).json({
            success: true,
            message: 'Event retrieved successfully',
            data: {
                ...event.toObject(),
                participantStats
            }
        });

    } catch (error) {
        console.error('Error getting event by slug:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve event'
        });
    }
};

// Edit Event (Admin)
const editEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            category, title, description, location, eventType,
            startDate, startTime, endDate, endTime, registrationDeadline, maxParticipants,
            price, tags, videos, removeImages 
        } = req.body;

        const event = await Event.findOne({ _id: id, isActive: true });
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Validate dates if provided
        if (startDate || endDate || registrationDeadline) {
            const start = startDate ? new Date(startDate) : event.startDate;
            const end = endDate ? new Date(endDate) : event.endDate;
            const regDeadline = registrationDeadline ? new Date(registrationDeadline) : event.registrationDeadline;
            
            if (start >= end) {
                return res.status(400).json({
                    success: false,
                    message: 'End date must be after start date'
                });
            }
            
            if (regDeadline >= start) {
                return res.status(400).json({
                    success: false,
                    message: 'Registration deadline must be before start date'
                });
            }
        }

        // Handle new uploaded images
        const newImages = req.files ? req.files.map(file => file.path.replace(/\\/g, '/')) : [];

        // Handle image removal
        let updatedImages = [...event.images];
        if (removeImages) {
            const imagesToRemove = typeof removeImages === 'string' ? JSON.parse(removeImages) : removeImages;
            if (Array.isArray(imagesToRemove)) {
                imagesToRemove.forEach(imagePath => {
                    const fullPath = path.join(__dirname, '..', imagePath);
                    if (fs.existsSync(fullPath)) {
                        fs.unlinkSync(fullPath);
                    }
                    updatedImages = updatedImages.filter(img => img !== imagePath);
                });
            }
        }

        // Add new images
        updatedImages = [...updatedImages, ...newImages];

        // Parse videos if it's a string
        let videoArray = event.videos;
        if (videos !== undefined) {
            try {
                videoArray = typeof videos === 'string' ? JSON.parse(videos) : videos;
                if (!Array.isArray(videoArray)) {
                    videoArray = [videos];
                }
            } catch (error) {
                videoArray = [videos];
            }
        }

        // Parse tags if it's a string
        let tagArray = event.tags;
        if (tags !== undefined) {
            try {
                tagArray = typeof tags === 'string' ? JSON.parse(tags) : tags;
                if (!Array.isArray(tagArray)) {
                    tagArray = [tags];
                }
            } catch (error) {
                tagArray = [tags];
            }
        }

        // Update event
        const updateData = {
            images: updatedImages,
            videos: videoArray,
            tags: tagArray
        };

        if (category) updateData.category = category;
        if (title) updateData.title = title;
        if (description) updateData.description = description;
        if (location) updateData.location = location;
        if (eventType) updateData.eventType = eventType;
        if (startDate) updateData.startDate = new Date(startDate);
        if (startTime) updateData.startTime = startTime;
        if (endDate) updateData.endDate = new Date(endDate);
        if (endTime) updateData.endTime = endTime;
        if (registrationDeadline) updateData.registrationDeadline = new Date(registrationDeadline);
        if (maxParticipants !== undefined) updateData.maxParticipants = maxParticipants;
        if (price !== undefined) updateData.price = price;

        const updatedEvent = await Event.findByIdAndUpdate(id, updateData, { new: true });

        res.status(200).json({
            success: true,
            message: 'Event updated successfully',
            data: updatedEvent
        });

    } catch (error) {
        console.error('Error editing event:', error);
        
        // Clean up uploaded files on error
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'An event with this title already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to update event'
        });
    }
};

// Get All Events with Filters (Admin)
const getAllEvents = async (req, res) => {
    try {
        const { title, startDate, endDate, location, page = 1, limit = 10 } = req.query;

        // Build filter object
        const filter = {isActive:true};

        // Title search (case-insensitive)
        if (title) {
            filter.$text = { $search: title };
        }

        // Date range filter
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) {
                filter.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.createdAt.$lte = new Date(endDate);
            }
        }

        // Location filter (case-insensitive partial match)
        if (location) {
            filter.location = { $regex: location, $options: 'i' };
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get events with pagination
        const events = await Event.find(filter)
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count for pagination
        const totalEvents = await Event.countDocuments(filter);
        const totalPages = Math.ceil(totalEvents / parseInt(limit));

        res.status(200).json({
            success: true,
            message: 'Events retrieved successfully',
            data: {
                events,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalEvents,
                    hasNextPage: parseInt(page) < totalPages,
                    hasPrevPage: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        console.error('Error getting all events:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve events'
        });
    }
};

// Get Event by ID (Admin)
const getEventById = async (req, res) => {
    try {
        const { id } = req.params;

        const event = await Event.findOne({ _id: id, isActive: true })
            .populate('createdBy', 'name email')
            .populate('enrollments.student', 'name email');

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Calculate participant counts
        const participantStats = {
            totalEnrollments: event.enrollments.length,
            approvedParticipants: event.enrollments.filter(e => e.status === 'approved').length,
            pendingRequests: event.enrollments.filter(e => e.status === 'pending').length,
            declinedRequests: event.enrollments.filter(e => e.status === 'declined').length,
            availableSpots: event.maxParticipants - event.enrollments.filter(e => e.status === 'approved').length
        };

        res.status(200).json({
            success: true,
            message: 'Event retrieved successfully',
            data: {
                ...event.toObject(),
                participantStats
            }
        });

    } catch (error) {
        console.error('Error getting event by ID:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve event'
        });
    }
};

// Delete Event (Admin)
const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;

        const event = await Event.findById(id,{isActive:true});
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Delete associated images
        // event.images.forEach(imagePath => {
        //     const fullPath = path.join(__dirname, '..', imagePath);
        //     if (fs.existsSync(fullPath)) {
        //         fs.unlinkSync(fullPath);
        //     }
        // });

        await Event.findByIdAndUpdate(id,{
            isActive:false
        });

        res.status(200).json({
            success: true,
            message: 'Event deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete event'
        });
    }
};

// Enroll in Event (Student)
const enrollInEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        const studentId = req.user.id;

        const event = await Event.findOne({ _id: eventId, isActive: true });
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Check if registration deadline has passed
        if (new Date() > event.registrationDeadline) {
            return res.status(400).json({
                success: false,
                message: 'Registration deadline has passed'
            });
        }

        // Check if student is already enrolled
        const existingEnrollment = event.enrollments.find(
            enrollment => enrollment.student.toString() === studentId
        );

        if (existingEnrollment) {
            return res.status(400).json({
                success: false,
                message: 'You are already enrolled in this event'
            });
        }

        // Check if event is full
        const approvedEnrollments = event.enrollments.filter(
            enrollment => enrollment.status === 'approved'
        );

        if (approvedEnrollments.length >= event.maxParticipants) {
            return res.status(400).json({
                success: false,
                message: 'Event is full'
            });
        }

        // Add enrollment
        event.enrollments.push({
            student: studentId,
            status: 'pending',
            requestedAt: new Date()
        });

        await event.save();

        res.status(200).json({
            success: true,
            message: 'Enrollment request submitted successfully'
        });

    } catch (error) {
        console.error('Error enrolling in event:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to enroll in event'
        });
    }
};

// Get Student's Enrollments
const getStudentEnrollments = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { status } = req.query;

        const filter = { 'enrollments.student': studentId, isActive: true };
        
        const events = await Event.find(filter)
            .populate('createdBy', 'name email')
            .populate('enrollments.student', 'name email');

        // Filter enrollments for this student
        const studentEnrollments = events.map(event => {

            const enrollment = event.enrollments.find(
                enr => enr.student._id.toString() === studentId.toString()
            ); 

            return {
                event: {
                    _id: event._id,
                    title: event.title,
                    description: event.description,
                    category: event.category,
                    location: event.location,
                    eventType: event.eventType,
                    startDate: event.startDate,
                    startTime: event.startTime,
                    endDate: event.endDate,
                    endTime: event.endTime,
                    price: event.price,
                    images: event.images,
                    createdBy: event.createdBy,
                },
                enrollment: enrollment
            };
        }).filter(item => !status || item.enrollment.status === status);

        res.status(200).json({
            success: true,
            message: 'Student enrollments retrieved successfully',
            data: studentEnrollments
        });

    } catch (error) {
        console.error('Error getting student enrollments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve enrollments'
        });
    }
};

// Manage Enrollment Status (Admin)
const manageEnrollment = async (req, res) => {
    try {
        const { eventId, enrollmentId } = req.params;
        const { status } = req.body;

        if (!['approved', 'declined'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status must be either approved or declined'
            });
        }

        const event = await Event.findOne({ _id: eventId, isActive: true });
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        const enrollment = event.enrollments.id(enrollmentId);
        if (!enrollment) {
            return res.status(404).json({
                success: false,
                message: 'Enrollment not found'
            });
        }

        // Check if approving would exceed max participants
        if (status === 'approved') {
            const approvedEnrollments = event.enrollments.filter(
                enr => enr.status === 'approved'
            );

            if (approvedEnrollments.length >= event.maxParticipants) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot approve enrollment - event is full'
                });
            }
        }

        enrollment.status = status;
        enrollment.updatedAt = new Date();

        await event.save();

        res.status(200).json({
            success: true,
            message: `Enrollment ${status} successfully`
        });

    } catch (error) {
        console.error('Error managing enrollment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to manage enrollment'
        });
    }
};

// Get Event Enrollments (Admin)
const getEventEnrollments = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { status } = req.query;

        const event = await Event.findOne({ _id: eventId, isActive: true })
            .populate('enrollments.student', 'name email phoneNumber college');

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        let enrollments = event.enrollments;
        if (status) {
            enrollments = enrollments.filter(enrollment => enrollment.status === status);
        }

        res.status(200).json({
            success: true,
            message: 'Event enrollments retrieved successfully',
            data: {
                event: {
                    _id: event._id,
                    title: event.title,
                    maxParticipants: event.maxParticipants,
                    category: event.category,
                    location: event.location,  
                    type: event.eventType
                },
                enrollments: enrollments,
                stats: {
                    total: event.enrollments.length,
                    pending: event.enrollments.filter(e => e.status === 'pending').length,
                    approved: event.enrollments.filter(e => e.status === 'approved').length,
                    declined: event.enrollments.filter(e => e.status === 'declined').length
                }
            }
        });

    } catch (error) {
        console.error('Error getting event enrollments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve event enrollments'
        });
    }
};

// Event Dashboard API
const getEventDashboard = async (req, res) => {
    try {
        const { category, timeFilter } = req.query;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Build base filter
        const baseFilter = { isActive: true };
        if (category) {
            baseFilter.category = category;
        }

        let todayEvents = [];
        let upcomingEvents = [];
        let pastEvents = [];

        if (!timeFilter || timeFilter === 'today') {
            // Today's events
            todayEvents = await Event.find({
                ...baseFilter,
                startDate: {
                    $gte: today,
                    $lt: tomorrow
                }
            })
            .populate('createdBy', 'name email')
            .sort({ startTime: 1 });
        }

        if (!timeFilter || timeFilter === 'upcoming') {
            // Upcoming events (after today)
            upcomingEvents = await Event.find({
                ...baseFilter,
                startDate: { $gte: tomorrow }
            })
            .populate('createdBy', 'name email')
            .sort({ startDate: 1, startTime: 1 })
            .limit(20);
        }

        if (!timeFilter || timeFilter === 'past') {
            // Past events
            pastEvents = await Event.find({
                ...baseFilter,
                endDate: { $lt: today }
            })
            .populate('createdBy', 'name email')
            .sort({ startDate: -1 })
            .limit(20);
        }

        // Add participant stats to each event
        const addParticipantStats = (events) => {
            return events.map(event => {
                const participantStats = {
                    totalEnrollments: event.enrollments.length,
                    approvedParticipants: event.enrollments.filter(e => e.status === 'approved').length,
                    pendingRequests: event.enrollments.filter(e => e.status === 'pending').length,
                    availableSpots: event.maxParticipants - event.enrollments.filter(e => e.status === 'approved').length
                };
                return {
                    ...event.toObject(),
                    participantStats
                };
            });
        };

        const dashboardData = {
            today: addParticipantStats(todayEvents),
            upcoming: addParticipantStats(upcomingEvents),
            past: addParticipantStats(pastEvents),
            summary: {
                todayCount: todayEvents.length,
                upcomingCount: upcomingEvents.length,
                pastCount: pastEvents.length,
                totalActiveEvents: await Event.countDocuments({ isActive: true, ...(category && { category }) })
            }
        };

        // If specific timeFilter is requested, return only that data
        if (timeFilter) {
            const responseData = {
                [timeFilter]: dashboardData[timeFilter],
                summary: dashboardData.summary
            };
            return res.status(200).json({
                success: true,
                message: `${timeFilter.charAt(0).toUpperCase() + timeFilter.slice(1)} events retrieved successfully`,
                data: responseData
            });
        }

        res.status(200).json({
            success: true,
            message: 'Event dashboard data retrieved successfully',
            data: dashboardData
        });

    } catch (error) {
        console.error('Error getting event dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve event dashboard data'
        });
    }
};

module.exports = {
    createEvent,
    getEventBySlug,
    editEvent,
    getAllEvents,
    getEventById,
    deleteEvent,
    enrollInEvent,
    getStudentEnrollments,
    manageEnrollment,
    getEventEnrollments,
    getEventDashboard
};

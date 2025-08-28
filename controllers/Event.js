const Event = require('../models/Event');
const fs = require('fs');
const path = require('path');

// Create Event (User/Admin)
const createEvent = async (req, res) => {
    try {
        const { title, description, location, videos } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!title || !description || !location) {
            return res.status(400).json({
                success: false,
                message: 'Title, description, and location are required'
            });
        }

        // Handle uploaded images
        const images = req.files ? req.files.map(file => file.path.replace(/\\/g, '/')) : [];

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

        // Create event
        const event = new Event({
            title,
            description,
            location,
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

        const event = await Event.findOne({ slug ,isActive:true}).populate('createdBy', 'name email');

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Event retrieved successfully',
            data: event
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
        const { title, description, location, videos, removeImages } = req.body;

        const event = await Event.findById(id,{isActive:true});
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
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

        // Update event
        const updateData = {
            images: updatedImages,
            videos: videoArray
        };

        if (title) updateData.title = title;
        if (description) updateData.description = description;
        if (location) updateData.location = location;

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

        const event = await Event.findById(id,{isActive:true}).populate('createdBy', 'name email');

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Event retrieved successfully',
            data: event
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

module.exports = {
    createEvent,
    getEventBySlug,
    editEvent,
    getAllEvents,
    getEventById,
    deleteEvent
};

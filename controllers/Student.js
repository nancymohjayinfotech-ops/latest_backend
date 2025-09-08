const Event = require('../models/Event');

const getAllEvents = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;
        const filter = {isActive:true};
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
        res.status(500).json({ success: false, message: 'Failed to get events', error });
    }
}

const getEventBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const event = await Event.findOne({ slug: slug, isActive: true });
        res.status(200).json({ success: true, data: event });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get event by slug', error });
    }
}

module.exports = { getAllEvents, getEventBySlug };

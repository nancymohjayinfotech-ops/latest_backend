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

const getAllQuizByStudent = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get pagination params (defaults: page=1, limit=10)
    let { page = 1, limit = 10 } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    // Fetch user with enrolled courses
    const user = await User.findById(userId).populate("enrolledCourses.course");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Extract course IDs
    const enrolledCourseIds = user.enrolledCourses.map(ec => ec.course._id);

    if (enrolledCourseIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          totalCount: 0,
          totalPages: 0,
          currentPage: page,
          pageSize: limit,
          hasNextPage: false,
          hasPrevPage: false
        }
      });
    }

    // Count total quizzes
    const totalCount = await Quiz.countDocuments({
      course: { $in: enrolledCourseIds },
      active: true,
      deletedAt: null
    });

    const totalPages = Math.ceil(totalCount / limit);

    // Fetch paginated quizzes
    const quizzes = await Quiz.find({
      course: { $in: enrolledCourseIds },
      active: true,
      deletedAt: null
    })
      .populate("course", "title")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: quizzes,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error("Error fetching quizzes:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getQuizById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { quizId } = req.params;

    // Fetch quiz
    const quiz = await Quiz.findOne({
      _id: quizId,
      active: true,
      deletedAt: null
    }).populate("course", "title");

    if (!quiz) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }

    // Check if user is enrolled in quiz.course
    const user = await User.findById(userId).select("enrolledCourses.course");
    const enrolledCourseIds = user.enrolledCourses.map(ec => ec.course.toString());

    if (!enrolledCourseIds.includes(quiz.course._id.toString())) {
      return res.status(403).json({ success: false, message: "Not enrolled in this course" });
    }

    // Optional: Fetch student's last attempt
    const lastAttempt = await QuizResult.findOne({
      student: userId,
      quiz: quizId
    })
      .sort({ createdAt: -1 })
      .select("score passed attempt createdAt");

    res.status(200).json({
      success: true,
      data: {
        quiz,
        lastAttempt: lastAttempt || null
      }
    });
  } catch (error) {
    console.error("Error fetching quiz by id:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


module.exports = { getAllEvents, getEventBySlug };

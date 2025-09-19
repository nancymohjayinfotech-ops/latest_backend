const mongoose = require('mongoose');
const Course = require('../models/Course');
const Content = require('../models/Content');
const Subcategory = require('../models/Subcategory');
const User = require('../models/User');
const { createCourseNotification } = require('./Notification');

// Create or update a course
const createCourse = async (req, res) => {
  try {
    const courseData = { ...req.body };
    let course;
    let isUpdate = false;
    
    // Check if this is an update operation (id is provided in request body)
    if (courseData._id) {
      isUpdate = true;
      
      // Don't allow updating these fields directly
      delete courseData.createdAt;
      
      // For update operations, we'll use findByIdAndUpdate later
    } else {
      // For new courses, check if a course with the same title already exists
      if (courseData.title) {
        const existingCourse = await Course.findOne({ 
          title: new RegExp(`^${courseData.title.trim()}$`, 'i'),
          instructor: courseData.instructor
        });
        
        if (existingCourse) {
          return res.status(400).json({
            success: false,
            message: 'A course with this title already exists for this instructor',
            existingCourse: {
              title: existingCourse.title,
              slug: existingCourse.slug
            }
          });
        }
      }
    }
    
    // Fix level enum - convert to lowercase
    if (courseData.level) {
      courseData.level = courseData.level.toLowerCase();
    }
    
    // Ensure instructor is provided for new courses
    if (!isUpdate && !courseData.instructor) {
      return res.status(400).json({
        success: false,
        message: 'Instructor ID is required'
      });
    }
    
    // Ensure category is a valid ObjectId
    if (courseData.category && typeof courseData.category === 'string' && !mongoose.Types.ObjectId.isValid(courseData.category)) {
      // Try to find category by name
      try {
        const Category = require('../models/Category');
        const category = await Category.findOne({ name: new RegExp(courseData.category, 'i') });
        
        if (category) {
          courseData.category = category._id;
        } else {
          return res.status(400).json({
            success: false,
            message: `Category '${courseData.category}' not found. Please provide a valid category ID or create the category first.`
          });
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category. Please provide a valid category ID.'
        });
      }
    }
    
    // Handle subcategory if provided
    if (courseData.subcategory || courseData.subcategoryId || courseData.subcategoryName) {
      try {
        // Check if category exists
        const Category = require('../models/Category');
        const category = await Category.findById(courseData.category);
        
        if (!category) {
          return res.status(400).json({
            success: false,
            message: 'Category not found'
          });
        }
        
        // Get subcategory ID
        const subcategoryId = courseData.subcategory || courseData.subcategoryId;
        const subcategoryName = courseData.subcategoryName;
        
        // Use the Subcategory model to find the subcategory
        const Subcategory = require('../models/Subcategory');
        let subcategory;
        
        if (subcategoryId) {
          // Try to find by ID
          if (mongoose.Types.ObjectId.isValid(subcategoryId)) {
            subcategory = await Subcategory.findById(subcategoryId);
          }
          
          // If not found by ID, try by slug
          if (!subcategory) {
            subcategory = await Subcategory.findOne({ slug: subcategoryId });
          }
        } else if (subcategoryName) {
          // Try to find by name
          subcategory = await Subcategory.findOne({ 
            name: new RegExp(subcategoryName, 'i'),
            categoryId: courseData.category
          });
        }
        
        if (subcategory) {
          // Just store the subcategory ID as per the Course model
          courseData.subcategory = subcategory._id;
        } else {
          return res.status(400).json({
            success: false,
            message: 'Subcategory not found in the specified category'
          });
        }
        
        // Remove temporary fields
        delete courseData.subcategoryId;
      } catch (error) {
        console.error('Error processing subcategory:', error);
        return res.status(500).json({
          success: false,
          message: 'Error processing subcategory',
          error: error.message
        });
      }
    }
    
    // Auto-generate video IDs and ensure each video has a URL
    if (courseData.introVideo && !courseData.introVideo.id) {
      courseData.introVideo.id = `intro-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    
    // Process sections and their videos
    if (courseData.sections && courseData.sections.length > 0) {
      let videoCount = 0;
      let totalSeconds = 0;
      
      courseData.sections = courseData.sections.map(section => {
        const processedSection = { ...section };
        
        if (!processedSection.id) {
          processedSection.id = `section-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        }
        
        if (section.videos && section.videos.length > 0) {
          videoCount += section.videos.length;
          
          processedSection.videos = section.videos.map(video => {
            const processedVideo = { ...video };
            
            if (!processedVideo.id) {
              processedVideo.id = `video-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            }
            
            if (!processedVideo.url) {
              console.warn(`Video in course ${courseData.title} is missing URL`);
              processedVideo.url = '';
            }
            
            if (processedVideo.durationSeconds) {
              totalSeconds += processedVideo.durationSeconds;
            }
            
            return processedVideo;
          });
        }
        
        return processedSection;
      });
      
      courseData.totalVideos = videoCount;
      courseData.totalDuration = totalSeconds;
    }
    
    // Recalculate average rating if ratings are updated
    if (courseData.ratings && courseData.ratings.length > 0) {
      const totalRating = courseData.ratings.reduce((sum, item) => sum + item.rating, 0);
      courseData.averageRating = totalRating / courseData.ratings.length;
    }
    
    // Handle create or update based on whether an ID was provided
    if (isUpdate) {
      // Update existing course
      const courseId = courseData._id;
      delete courseData._id; // Remove _id from the update data
      
      // Get the original course to check if published status changed
      const originalCourse = await Course.findById(courseId);
      const wasPublished = originalCourse ? originalCourse.published : false;
      
      course = await Course.findByIdAndUpdate(
        courseId,
        courseData,
        { new: true, runValidators: true }
      ).populate('instructor', 'name email avatar')
       .populate('category', 'name');
       
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      // Create notifications for course updates
      try {
        // If course was just published, notify all students
        if (!wasPublished && course.published) {
          const students = await User.find({ 
            role: 'student', 
            isActive: true,
            'notificationPreferences.newEnrollments': true 
          }).select('_id');
          
          const studentIds = students.map(student => student._id);
          
          if (studentIds.length > 0) {
            await createCourseNotification(course, 'course_published', studentIds);
          }
        } else if (course.published) {
          // If course was already published and updated, notify enrolled students
          const enrolledStudentIds = course.enrolledStudents || [];
          
          if (enrolledStudentIds.length > 0) {
            await createCourseNotification(course, 'course_updated', enrolledStudentIds);
          }
        }
      } catch (notificationError) {
        console.error('Error creating course update notifications:', notificationError);
        // Don't fail the course update if notifications fail
      }
      
      return res.status(200).json({
        success: true,
        course
      });
    } else {
      // Create new course
      course = new Course(courseData);
      await course.save();

      // Create notifications for students about new course
      try {
        const students = await User.find({ 
          role: 'student', 
          isActive: true,
          'notificationPreferences.newEnrollments': true 
        }).select('_id');
        
        const studentIds = students.map(student => student._id);
        
        if (studentIds.length > 0) {
          await createCourseNotification(course, 'course_created', studentIds);
        }
      } catch (notificationError) {
        console.error('Error creating course notifications:', notificationError);
        // Don't fail the course creation if notifications fail
      }
      
      return res.status(201).json({
        success: true,
        course
      });
    }
  } catch (error) {
    console.error('Error creating/updating course:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating/updating course',
      error: error.message
    });
  }
};

// Get course by ID or slug
const getCourseById = async (req,res) => {
  try {
    let course;
    const { id } = req.params;
    
    // Check if the id is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);
    
    if (isValidObjectId) {
      course = await Course.findById(id);
    } else {
      // If not a valid ObjectId, try to find by slug
      course = await Course.findOne({ slug: id });
    }
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }
    return res.status(200).json({
      success: true,
      course
    });
  } catch (error) {
    console.error('Error getting course:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching course',
      error: error.message
    });
  }
};

/**
 * Get course by slug with detailed information
 * @route GET /api/courses/slug/:slug
 * @access Private
 */
const getCourseBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Find course by slug
    const course = await Course.findOne({ slug: slug });
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }
    
    // Populate instructor with detailed information
    await course.populate('instructor', 'name email avatar bio title');
    
    // Populate category and subcategory
    await course.populate('category', 'name slug');
    await course.populate('subcategory', 'name slug');
    
    // Process embedded sections and count videos
    let videoCount = 0;
    const processedSections = [];
    
    // Use the embedded sections from the course document
    if (course.sections && course.sections.length > 0) {
      // Sort sections by order
      const sortedSections = [...course.sections].sort((a, b) => a.order - b.order);
      
      for (const section of sortedSections) {
        // Count videos in this section
        const sectionVideoCount = section.videos ? section.videos.length : 0;
        videoCount += sectionVideoCount;
        
        processedSections.push({
          _id: section._id,
          title: section.title,
          description: section.description,
          order: section.order,
          videoCount: sectionVideoCount
        });
      }
    }
    
    // Get total enrolled students count
    const enrolledStudentsCount = course.enrolledStudents ? course.enrolledStudents.length : 0;
    
    // Get ratings and reviews
    const ratings = course.ratings || [];
    const averageRating = course.averageRating || 0;
    
    // Check if current user is enrolled (if authenticated and student)
    let isEnrolled = false;
    if (req.user && req.user.role === 'student') {
      isEnrolled = course.enrolledStudents.some(studentId => 
        studentId.toString() === req.user.id.toString()
      );
    }
    
    // Format response
    const formattedCourse = {
      _id: course._id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      shortDescription: course.shortDescription,
      thumbnail: course.thumbnail,
      price: course.price,
      discountedPrice: course.discountedPrice,
      level: course.level,
      language: course.language,
      duration: course.duration,
      published: course.published,
      isActive: course.isActive,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      instructor: course.instructor,
      category: course.category,
      subcategory: course.subcategory,
      sections: processedSections,
      totalSections: processedSections.length,
      videoCount: videoCount,
      enrolledStudentsCount: enrolledStudentsCount,
      ratings: {
        average: averageRating,
        count: ratings.length,
        distribution: {
          5: ratings.filter(r => r.rating === 5).length,
          4: ratings.filter(r => r.rating === 4).length,
          3: ratings.filter(r => r.rating === 3).length,
          2: ratings.filter(r => r.rating === 2).length,
          1: ratings.filter(r => r.rating === 1).length
        },
        reviews: ratings.filter(r => r.review && r.review.trim() !== '').map(r => ({
          _id: r._id,
          rating: r.rating,
          review: r.review,
          user: r.user,
          createdAt: r.createdAt
        }))
      }
    };
    
    // Add enrollment status if user is authenticated
    if (req.user) {
      formattedCourse.isEnrolled = isEnrolled;
    }
    
    return res.status(200).json({
      success: true,
      message: 'Course retrieved successfully',
      data: {
        course: formattedCourse
      }
    });
  } catch (error) {
    console.error('Error fetching course by slug:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching course',
      error: error.message
    });
  }
};

/**
 * Get all courses with pagination and user-specific flags
 * @route GET /api/courses
 * @access Public/Private
 */
const getAllCourses = async (req, res) => {
  try {
    console.log(req.query);
    let query = { published: true };
    
    // Apply filters from req.query
    if (req.query.category) {
      query.category = req.query.category;
    }
    if (req.query.subcategory) {
      query.subcategory = req.query.subcategory;
    }
    if (req.query.level) {
      query.level = req.query.level;
    }
    
    if (req.query.published !== undefined) {
      query.published = req.query.published === 'true';
    }
     
    if (req.query.instructor) {
      query.instructor = req.query.instructor;
    }

    // Apply search filter
    if (req.query.search && req.query.search.trim() !== '') {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex }
      ];
    }
    
    // Set up pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const totalCount = await Course.countDocuments(query);
    
    // Execute query with pagination
    const courses = await Course.find(query)
      .populate('instructor', 'name email avatar')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Format courses with user-specific flags if user is authenticated
    let formattedCourses = courses;
    
    if (req.user) {
      // Get user data if authenticated
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // Get user data with enrolled courses if needed
      let userData = null;
      if (userRole === 'student') {
        userData = await User.findById(userId).select('enrolledCourses');
      }
      
      // Add user-specific flags to each course
      formattedCourses = courses.map(course => {
        const courseObj = course.toObject();
        
        // Add isEnrolled flag for students
        if (userRole === 'student' && userData) {
          courseObj.isEnrolled = userData.enrolledCourses && 
            userData.enrolledCourses.some(enrollment => 
              enrollment.course && enrollment.course.toString() === course._id.toString()
            );
        }
        
        // Add isTrainer flag for instructors
        if (userRole === 'instructor') {
          courseObj.isTrainer = course.instructor && 
            course.instructor._id && 
            course.instructor._id.toString() === userId.toString();
        }
        
        return courseObj;
      });
    }
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return res.status(200).json({
      success: true,
      message: 'Courses retrieved successfully',
      data: {
        courses: formattedCourses,
        count: formattedCourses.length,
        pagination: {
          totalCount,
          totalPages,
          currentPage: page,
          pageSize: limit,
          hasNextPage,
          hasPrevPage
        }
      }
    });
  } catch (error) {
    console.error('Error getting courses:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting courses',
      error: error.message
    });
  }
};


const getAllCoursesWithPagination = async (req, res) => {
  try {
    let query = { published: true };
    
    // Apply filters from req.query
    if (req.query.category) {
      query.category = req.query.category;
    }
    if (req.query.subcategory) {
      query.subcategory = req.query.subcategory;
    }
    if (req.query.level) {
      query.level = req.query.level;
    }
    
    if (req.query.published !== undefined) {
      query.published = req.query.published === 'true';
    }
    
    if (req.query.instructor) {
      query.instructor = req.query.instructor;
    }
    
    let courseQuery = Course.find(query)
      .populate('instructor', 'name email avatar')
      .populate('category', 'name')
      .populate('subcategory', 'name');
    
    // Apply search filter
    if (req.query.search && req.query.search.trim() !== '') {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex }
      ];
      courseQuery = Course.find(query)
        .populate('instructor', 'name email avatar')
        .populate('category', 'name')
        .populate('subcategory', 'name');
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const totalCount = await Course.countDocuments(query);
    const courses = await courseQuery.skip(skip).limit(limit).exec();
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return res.status(200).json({
      success: true,
      count: courses.length,
      courses,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error getting all courses',
      error: error.message
    });
  }
};


// Delete course
const deleteCourse = async (req,res) => {
  try {
    const course = await Course.findOne({ _id: req.params.id });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }
    if (!course.published) {
      return res.status(400).json({
        success: false,
        message: 'Course is Already deleted'
      });
    }
    await Course.findByIdAndUpdate(req.params.id, { published: false });
    return res.status(200).json({
      success: true
    });
  } catch (error) {
    console.error('Error deleting course:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting course'
    });
  }
};

// Add rating to course
const addRating = async (req,res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }
    
    // Check if rating is provided
    if (!req.body.rating) {
      return res.status(400).json({
        success: false,
        message: 'Rating is required'
      });
    }
    
    // Prepare rating object with authenticated user ID
    const rating = {
      rating: req.body.rating,
      review: req.body.review || '',
      user: req.user.id, // Use authenticated user ID from req.user
      createdAt: new Date()
    };
    
    // Add rating to course
    course.ratings.push(rating);
    
    // Calculate new average rating
    const totalRating = course.ratings.reduce((sum, item) => sum + item.rating, 0);
    course.averageRating = totalRating / course.ratings.length;
    
    await course.save();
    
    return res.status(200).json({
      success: true,
      averageRating: course.averageRating
    });
  } catch (error) {
    console.error('Error adding rating to course:', error);
    return res.status(500).json({
      success: false,
      message: 'Error adding rating to course'
    });
  }
};

// Enroll student in course
// const enrollStudent = async (req,res) => {
//   try {
//     // Use the authenticated user's ID from req.user
//     await Course.findByIdAndUpdate(
//       req.params.id,
//       { $addToSet: { enrolledStudents: req.user.id } }
//     );
    
//     return res.status(200).json({
//       success: true,
//       message: 'Successfully enrolled in course'
//     });
//   } catch (error) {
//     console.error('Error enrolling student in course:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Error enrolling student in course'
//     });
//   }
// };

const enrollStudent = async (req, res) => {
  try {
    const courseId = req.params.id;
    const userId = req.user.id;

    // Add student to course
    await Course.findByIdAndUpdate(
      courseId,
      { $addToSet: { enrolledStudents: userId } },
      { new: true }
    );

    // Add course to student's enrolledCourses
    await User.findByIdAndUpdate(
      userId,
      { 
        $addToSet: { 
          enrolledCourses: { course: courseId } 
        } 
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Successfully enrolled in course'
    });
  } catch (error) {
    console.error('Error enrolling student in course:', error);
    return res.status(500).json({
      success: false,
      message: 'Error enrolling student in course'
    });
  }
};

/**
 * Get featured courses based on isFeatured flag
 * @route GET /api/courses/featured
 * @access Private (Student only)
 */
const getFeaturedCourses = async (req, res) => {
  try {
    // Extract pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get the current user with their interests
    const user = await User.findById(req.user.id)
      .select('interests enrolledCourses favoriteCourses');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Base query for featured courses
    const baseQuery = { isFeatured: true, published: true };
    let query = { ...baseQuery };
    let courses;
    
    // If user has interests, try to find featured courses matching their interests
    if (user.interests && user.interests.categories && user.interests.categories.length > 0) {
      const interestQuery = {
        ...baseQuery,
        $or: [
          { category: { $in: user.interests.categories } },
          { subcategory: { $in: user.interests.subcategories } }
        ]
      };
      
      // First check if there are any interest-based featured courses
      const interestCoursesCount = await Course.countDocuments(interestQuery);
      
      if (interestCoursesCount > 0) {
        // If we have interest-based featured courses, use that query
        query = interestQuery;
      }
    }
    
    // Get featured courses based on the final query
    courses = await Course.find(query)
      .sort({ createdAt: -1, averageRating: -1 })
      .skip(skip)
      .limit(limit)
      .populate('instructor', 'name avatar')
      .populate('category', 'name')
      .populate('subcategory', 'name');
    
    // If we don't have enough courses with the current query, fall back to all featured courses
    if (courses.length < limit && query !== baseQuery) {
      const remainingLimit = limit - courses.length;
      const remainingSkip = Math.max(0, skip - await Course.countDocuments(query));
      
      // Get IDs of already fetched courses to exclude them
      const existingIds = courses.map(course => course._id);
      
      // Get additional featured courses
      const additionalCourses = await Course.find({
        ...baseQuery,
        _id: { $nin: existingIds }
      })
        .sort({ createdAt: -1, averageRating: -1 })
        .skip(remainingSkip)
        .limit(remainingLimit)
        .populate('instructor', 'name avatar')
        .populate('category', 'name')
        .populate('subcategory', 'name');
      
      // Combine the results
      courses = [...courses, ...additionalCourses];
    }
    
    // Get total count of featured courses
    const totalCount = await Course.countDocuments(baseQuery);
    
    return formatCoursesResponse(res, courses, totalCount, page, limit, user);
    
  } catch (error) {
    console.error('Error getting featured courses:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Get popular courses based on user interests
 * @route GET /api/courses/popular
 * @access Private (Student only)
 */
/**
 * Get courses by subcategory with pagination
 * @route GET /api/courses/subcategory/:subcategoryId
 * @access Public
 */
const getCoursesBySubcategory = async (req, res) => {
  try {
    const { subcategoryId } = req.params;
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Validate subcategory ID
    if (!mongoose.Types.ObjectId.isValid(subcategoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subcategory ID format'
      });
    }
    
    // Check if subcategory exists
    const subcategory = await Subcategory.findById(subcategoryId);
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found'
      });
    }
    
    // Get category ID from subcategory
    const categoryId = subcategory.categoryId;
    
    // Set up pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Set up sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Find courses by subcategory and category
    const courses = await Course.find({
      subcategory: subcategoryId,
      category: categoryId,
      published: true
    })
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .populate('instructor', 'name email')
      .populate('category', 'name')
      .populate('subcategory', 'name');
    
    // Get total count for pagination
    const totalCourses = await Course.countDocuments({
      subcategory: subcategoryId,
      category: categoryId,
      published: true
    });
    
    // Format response with user-specific data if user is logged in
    let formattedCourses = courses;
    if (req.user) {
      formattedCourses = await formatCoursesResponse(courses, req.user.id);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Courses retrieved successfully',
      data: {
        courses: formattedCourses,
        pagination: {
          total: totalCourses,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(totalCourses / limitNum)
        },
        subcategory: {
          _id: subcategory._id,
          name: subcategory.name,
          categoryId: categoryId
        }
      }
    });
  } catch (error) {
    console.error('Error getting courses by subcategory:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting courses by subcategory',
      error: error.message
    });
  }
};

const getPopularCourses = async (req, res) => {
  try {
    // Extract pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get the current user with their interests
    const user = await User.findById(req.user.id)
      .select('interests enrolledCourses favoriteCourses');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // If user has no interests set, return general popular courses
    if (!user.interests || !user.interests.categories || user.interests.categories.length === 0) {
      // Get popular courses (most enrolled, highest rated)
      const courses = await Course.find({ published: true })
        .sort({ enrolledStudents: -1, averageRating: -1 })
        .skip(skip)
        .limit(limit)
        .populate('instructor', 'name avatar')
        .populate('category', 'name')
        .populate('subcategory', 'name');
      
      const totalCount = await Course.countDocuments({ isActive: true });
      
      return formatCoursesResponse(res, courses, totalCount, page, limit, user);
    }
    
    // Get popular courses based on user interests
    const courses = await Course.find({
      published: true,
      $or: [
        { category: { $in: user.interests.categories } },
        { subcategory: { $in: user.interests.subcategories } }
      ]
    })
      .sort({ enrolledStudents: -1, averageRating: -1 })
      .skip(skip)
      .limit(limit)
      .populate('instructor', 'name avatar')
      .populate('category', 'name')
      .populate('subcategory', 'name');
    
    const totalCount = await Course.countDocuments({
      isActive: true,
      $or: [
        { category: { $in: user.interests.categories } },
        { subcategory: { $in: user.interests.subcategories } }
      ]
    });
    
    return formatCoursesResponse(res, courses, totalCount, page, limit, user);
  } catch (error) {
    console.error('Error getting popular courses:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Helper function to format courses response with pagination and user-specific flags
const formatCoursesResponse = (res, courses, totalCount, page, limit, user) => {
  // console.log(courses);
  // return
  // Format courses with enrollment and favorite status
  const formattedCourses = courses.map(course => {
    const isEnrolled = user.enrolledCourses && 
      user.enrolledCourses.some(enrollment => 
        enrollment.course && enrollment.course.toString() === course._id.toString()
      );
    
    const isFavorite = user.favoriteCourses && 
      user.favoriteCourses.some(favoriteId => 
        favoriteId.toString() === course._id.toString()
      );
    
    return {
      _id: course._id,
      title: course.title,
      slug: course.slug,
      thumbnail: course.thumbnail,
      price: course.price,
      discountedPrice: course.discountedPrice,
      rating: course.averageRating,
      ratingCount: course.ratings ? course.ratings.length : 0,
      enrollmentCount: course.enrolledStudents ? course.enrolledStudents.length : 0,
      instructor: course.instructor,
      category: course.category,
      subcategory: course.subcategory,
      isEnrolled,
      isFavorite
    };
  });
  
  // Calculate pagination metadata
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  
  return res.status(200).json({
    success: true,
    message: 'Courses retrieved successfully',
    data: {
      courses: formattedCourses,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage,
        hasPrevPage
      }
    }
  });
};

const getRecommendedCourses = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.user.id)
      .select('interests enrolledCourses favoriteCourses')
      .populate({
        path: 'enrolledCourses.course',
        select: 'category subcategory level'
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }


    let recommendedCourses = [];
    let totalCount = 0;

    // const enrolledCourseIds = user.enrolledCourses
    // .map(enrollment => enrollment?.toString())
    // .filter(Boolean);

     const enrolledCourseIds = user.enrolledCourses
  .map(enrollment => enrollment.course?._id?.toString())
  .filter(Boolean);

    // If user has interests
    if (user.interests?.categories?.length > 0) {
      const interestBasedQuery = {
        published: true,
        $or: [
          { category: { $in: user.interests.categories } },
          { subcategory: { $in: user.interests.subcategories || [] } }
        ],
        ...(enrolledCourseIds.length > 0 && { _id: { $nin: enrolledCourseIds } })
      };

      const interestCourses = await Course.find(interestBasedQuery)
        .populate('instructor', 'name avatar')
        .populate('category', 'name')
        .populate('subcategory', 'name');

      const scoredCourses = interestCourses.map(course => {
        let score = 0;

        const categoryMatch = user.interests.categories
        .map(id => id.toString())
        .includes(course.category?._id?.toString() || '');
      
      const subcategoryMatch = user.interests.subcategories
        ?.map(id => id.toString())
        .includes(course.subcategory?._id?.toString() || '');

        if (categoryMatch) score += 10;
        if (subcategoryMatch) score += 15;

        score += (course.averageRating || 0) * 2;
        const enrollmentCount = course.enrolledStudents?.length || 0;
        score += Math.min(enrollmentCount * 0.1, 5);

        const daysSinceCreation =
          (Date.now() - new Date(course.createdAt)) / (1000 * 60 * 60 * 24);
        if (daysSinceCreation < 30) score += 3;
        else if (daysSinceCreation < 90) score += 1;

        if (user.enrolledCourses?.length > 0) {
          const userLevels = user.enrolledCourses
            .map(enrollment => enrollment.course?.level || 'beginner');

          if (userLevels.includes('beginner') && course.level === 'intermediate') {
            score += 5;
          } else if (userLevels.includes('intermediate') && course.level === 'advanced') {
            score += 5;
          }
        }

        return { course, score };
      });

      scoredCourses.sort((a, b) => b.score - a.score);

      const paginatedScored = scoredCourses.slice(skip, skip + limit);
      recommendedCourses = paginatedScored.map(item => item.course);
      totalCount = scoredCourses.length;

    } else {
      const fallbackQuery = {
        published: true,
        ...(enrolledCourseIds.length > 0 && { _id: { $nin: enrolledCourseIds } })
      };

      recommendedCourses = await Course.find(fallbackQuery)
        .sort({ averageRating: -1, enrolledStudents: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('instructor', 'name avatar')
        .populate('category', 'name')
        .populate('subcategory', 'name');

      totalCount = await Course.countDocuments(fallbackQuery);
    }

    return formatCoursesResponse(res, recommendedCourses, totalCount, page, limit, user);

  } catch (error) {
    console.error('Error getting recommended courses:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


module.exports = {
  createCourse,
  getCourseById,
  getCourseBySlug,
  getAllCourses,
  deleteCourse,
  enrollStudent,
  addRating,
  getAllCoursesWithPagination,
  getFeaturedCourses,
  getPopularCourses,
  getCoursesBySubcategory,
  getRecommendedCourses
};

const mongoose = require('mongoose');
const Course = require('../models/Course');
const Content = require('../models/Content');
const Subcategory = require('../models/Subcategory');
const User = require('../models/User');
const { createCourseNotification } = require('./Notification');
const { sendNotification } = require('../services/notificationService');

// Create or update a course
const createCourse = async (req, res) => {
  try {
    const courseData = { ...req.body };
    let course;
    let isUpdate = false;
    
    if (courseData._id) {
      isUpdate = true;
      delete courseData.createdAt;
    } else {
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
    
    if (courseData.level) {
      courseData.level = courseData.level.toLowerCase();
    }
    
    if (!isUpdate && !courseData.instructor) {
      return res.status(400).json({
        success: false,
        message: 'Instructor ID is required'
      });
    }
    
    if (courseData.category && typeof courseData.category === 'string' && !mongoose.Types.ObjectId.isValid(courseData.category)) {
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
    
    if (courseData.subcategory || courseData.subcategoryId || courseData.subcategoryName) {
      try {
        const Category = require('../models/Category');
        const category = await Category.findById(courseData.category);
        
        if (!category) {
          return res.status(400).json({
            success: false,
            message: 'Category not found'
          });
        }
        
        const subcategoryId = courseData.subcategory || courseData.subcategoryId;
        const subcategoryName = courseData.subcategoryName;
        
        const Subcategory = require('../models/Subcategory');
        let subcategory;
        
        if (subcategoryId) {
          if (mongoose.Types.ObjectId.isValid(subcategoryId)) {
            subcategory = await Subcategory.findById(subcategoryId);
          }
          
          if (!subcategory) {
            subcategory = await Subcategory.findOne({ slug: subcategoryId });
          }
        } else if (subcategoryName) {
          subcategory = await Subcategory.findOne({ 
            name: new RegExp(subcategoryName, 'i'),
            categoryId: courseData.category
          });
        }
        
        if (subcategory) {
          courseData.subcategory = subcategory._id;
        } else {
          return res.status(400).json({
            success: false,
            message: 'Subcategory not found in the specified category'
          });
        }
        
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
    
    if (courseData.introVideo && !courseData.introVideo.id) {
      courseData.introVideo.id = `intro-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    
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
    
    if (courseData.ratings && courseData.ratings.length > 0) {
      const totalRating = courseData.ratings.reduce((sum, item) => sum + item.rating, 0);
      courseData.averageRating = totalRating / courseData.ratings.length;
    }
    
    if (isUpdate) {
      const courseId = courseData._id;
      delete courseData._id;
      
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

      try {
        if (!wasPublished && course.published) {
          const students = await User.find({ 
            role: 'student', 
            isActive: true,
            'notificationPreferences.newEnrollments': true 
          }).select('_id');
          
          const studentIds = students.map(student => student._id);
          
          if (studentIds.length > 0) {
            await createCourseNotification(course, 'course_published', studentIds);

            await sendNotification({
                recipients: studentIds,
                sender: course.instructor._id,
                type: 'course_published',
                title: 'New Course Published!',
                message: `A new course, '${course.title}', is now available.`,
                data: { courseId: course._id }
            });
          }
        } else if (course.published) {
          const enrolledStudentIds = course.enrolledStudents || [];
          
          if (enrolledStudentIds.length > 0) {
            await createCourseNotification(course, 'course_updated', enrolledStudentIds);

            await sendNotification({
                recipients: enrolledStudentIds,
                sender: course.instructor._id,
                type: 'course_updated',
                title: `Course Updated: ${course.title}`,
                message: `There are new updates to the course '${course.title}'.`,
                data: { courseId: course._id }
            });
          }
        }
      } catch (notificationError) {
        console.error('Error creating course update notifications:', notificationError);
      }
      
      return res.status(200).json({
        success: true,
        course
      });
    } else {
      course = new Course(courseData);
      await course.save();

      try {
        const students = await User.find({ 
          role: 'student', 
          isActive: true,
          'notificationPreferences.newEnrollments': true 
        }).select('_id');
        
        const studentIds = students.map(student => student._id);
        
        if (studentIds.length > 0) {
          await createCourseNotification(course, 'course_created', studentIds);

            await sendNotification({
                recipients: studentIds,
                sender: course.instructor,
                type: 'course_created',
                title: 'New Course Available!',
                message: `Check out the new course: '${course.title}'.`,
                data: { courseId: course._id }
            });
        }
      } catch (notificationError) {
        console.error('Error creating course notifications:', notificationError);
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
    
    const mongoose = require('mongoose');
    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);
    
    if (isValidObjectId) {
      course = await Course.findById(id);
    } else {
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

const getCourseBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    const course = await Course.findOne({ slug: slug });
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }
    
    await course.populate('instructor', 'name email avatar bio title');
    
    await course.populate('category', 'name slug');
    await course.populate('subcategory', 'name slug');
    
    let videoCount = 0;
    const processedSections = [];
    
    if (course.sections && course.sections.length > 0) {
      const sortedSections = [...course.sections].sort((a, b) => a.order - b.order);
      
      for (const section of sortedSections) {
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
    
    const enrolledStudentsCount = course.enrolledStudents ? course.enrolledStudents.length : 0;
    
    const ratings = course.ratings || [];
    const averageRating = course.averageRating || 0;
    
    let isEnrolled = false;
    if (req.user && req.user.role === 'student') {
      isEnrolled = course.enrolledStudents.some(studentId => 
        studentId.toString() === req.user.id.toString()
      );
    }
    
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

const getAllCourses = async (req, res) => {
  try {
    console.log(req.query);
    let query = { published: true };
    
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

    if (req.query.search && req.query.search.trim() !== '') {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex }
      ];
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const totalCount = await Course.countDocuments(query);
    
    const courses = await Course.find(query)
      .populate('instructor', 'name email avatar')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    let formattedCourses = courses;
    
    if (req.user) {
      const userId = req.user.id;
      const userRole = req.user.role;
      
      let userData = null;
      if (userRole === 'student') {
        userData = await User.findById(userId).select('enrolledCourses');
      }
      
      formattedCourses = courses.map(course => {
        const courseObj = course.toObject();
        
        if (userRole === 'student' && userData) {
          courseObj.isEnrolled = userData.enrolledCourses && 
            userData.enrolledCourses.some(enrollment => 
              enrollment.course && enrollment.course.toString() === course._id.toString()
            );
        }
        
        if (userRole === 'instructor') {
          courseObj.isTrainer = course.instructor && 
            course.instructor._id && 
            course.instructor._id.toString() === userId.toString();
        }
        
        return courseObj;
      });
    }
    
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
    
    if (!req.body.rating) {
      return res.status(400).json({
        success: false,
        message: 'Rating is required'
      });
    }
    
    const rating = {
      rating: req.body.rating,
      review: req.body.review || '',
      user: req.user.id,
      createdAt: new Date()
    };
    
    course.ratings.push(rating);
    
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

const enrollStudent = async (req, res) => {
  try {
    const courseId = req.params.id;
    const userId = req.user.id;

    await Course.findByIdAndUpdate(
      courseId,
      { $addToSet: { enrolledStudents: userId } },
      { new: true }
    );

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

const getFeaturedCourses = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const user = await User.findById(req.user.id)
      .select('interests enrolledCourses favoriteCourses');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const baseQuery = { isFeatured: true, published: true };
    let query = { ...baseQuery };
    let courses;
    
    if (user.interests && user.interests.categories && user.interests.categories.length > 0) {
      const interestQuery = {
        ...baseQuery,
        $or: [
          { category: { $in: user.interests.categories } },
          { subcategory: { $in: user.interests.subcategories } }
        ]
      };
      
      const interestCoursesCount = await Course.countDocuments(interestQuery);
      
      if (interestCoursesCount > 0) {
        query = interestQuery;
      }
    }
    
    courses = await Course.find(query)
      .sort({ createdAt: -1, averageRating: -1 })
      .skip(skip)
      .limit(limit)
      .populate('instructor', 'name avatar')
      .populate('category', 'name')
      .populate('subcategory', 'name');
    
    if (courses.length < limit && query !== baseQuery) {
      const remainingLimit = limit - courses.length;
      const remainingSkip = Math.max(0, skip - await Course.countDocuments(query));
      
      const existingIds = courses.map(course => course._id);
      
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
      
      courses = [...courses, ...additionalCourses];
    }
    
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

const getCoursesBySubcategory = async (req, res) => {
  try {
    const { subcategoryId } = req.params;
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(subcategoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subcategory ID format'
      });
    }
    
    const subcategory = await Subcategory.findById(subcategoryId);
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found'
      });
    }
    
    const categoryId = subcategory.categoryId;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
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
    
    const totalCourses = await Course.countDocuments({
      subcategory: subcategoryId,
      category: categoryId,
      published: true
    });
    
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const user = await User.findById(req.user.id)
      .select('interests enrolledCourses favoriteCourses');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (!user.interests || !user.interests.categories || user.interests.categories.length === 0) {
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

const formatCoursesResponse = (res, courses, totalCount, page, limit, user) => {
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

     const enrolledCourseIds = user.enrolledCourses
  .map(enrollment => enrollment.course?._id?.toString())
  .filter(Boolean);

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
//   enrollInCourse,
  addRating,
  getAllCoursesWithPagination,
  getFeaturedCourses,
  getPopularCourses,
  getCoursesBySubcategory,
  getRecommendedCourses
};

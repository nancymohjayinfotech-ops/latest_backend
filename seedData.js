const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');
const slugify = require('slugify');
require('dotenv').config();

// Import models
const Category = require('./models/Category');
const Subcategory = require('./models/Subcategory');
const User = require('./models/User');
const Course = require('./models/Course');
const Group = require('./models/Group');
const Message = require('./models/Message');
const Event = require('./models/Event');
const Notification = require('./models/Notification');
const Quiz = require('./models/Quiz');
const QuizResult = require('./models/QuizResult');
const Assessment = require('./models/Assessment');
const AssessmentResult = require('./models/AssessmentResult');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lms')
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Helper function to generate a random number within a range
const randomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper function to get random items from an array
const getRandomItems = (array, count) => {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Helper function to generate Indian mobile number
const generateIndianMobile = () => {
  const prefixes = ['6', '7', '8', '9'];
  const prefix = faker.helpers.arrayElement(prefixes);
  const remaining = faker.string.numeric(9);
  return `${prefix}${remaining}`;
};

// Helper function to generate Indian cities
const indianCities = [
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 
  'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow',
  'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal'
];

// Helper function to generate Indian states
const indianStates = [
  'Maharashtra', 'Delhi', 'Karnataka', 'Telangana', 'Tamil Nadu',
  'West Bengal', 'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'Madhya Pradesh'
];

// Helper function to generate Indian colleges
const indianColleges = [
  'IIT Bombay', 'IIT Delhi', 'IIT Madras', 'IIT Kanpur', 'IIT Kharagpur',
  'BITS Pilani', 'Delhi University', 'Mumbai University', 'Jadavpur University',
  'Anna University', 'VIT Vellore', 'NIT Trichy', 'NIT Warangal', 'IIIT Hyderabad',
  'Manipal Institute of Technology', 'Amity University', 'SRM University'
];

// Clear existing data
const clearData = async () => {
  console.log('Clearing existing data...');
  await Category.deleteMany({});
  await Subcategory.deleteMany({});
  await User.deleteMany({});
  await Course.deleteMany({});
  await Group.deleteMany({});
  await Message.deleteMany({});
  await Event.deleteMany({});
  await Notification.deleteMany({});
  await Quiz.deleteMany({});
  await QuizResult.deleteMany({});
  await Assessment.deleteMany({});
  await AssessmentResult.deleteMany({});
  console.log('Data cleared successfully');
};

// Create categories and subcategories
const createCategories = async () => {
  console.log('Creating categories and subcategories...');
  
  const categories = [
    {
      name: 'Web Development',
      description: 'Learn to build modern web applications and websites',
      icon: 'code',
      backgroundColor: '#4CAF50',
      tags: ['programming', 'web', 'frontend', 'backend', 'javascript', 'html', 'css'],
      slug: slugify('Web Development', { lower: true, strict: true })
    },
    {
      name: 'App Development',
      description: 'Create mobile applications for iOS and Android',
      icon: 'smartphone',
      backgroundColor: '#2196F3',
      tags: ['mobile', 'android', 'ios', 'flutter', 'react native', 'swift'],
      slug: slugify('App Development', { lower: true, strict: true })
    },
    {
      name: 'Digital Marketing',
      description: 'Master digital marketing strategies and tools',
      icon: 'campaign',
      backgroundColor: '#FFC107',
      tags: ['marketing', 'seo', 'social media', 'content', 'analytics'],
      slug: slugify('Digital Marketing', { lower: true, strict: true })
    },
    {
      name: 'Graphic Designing',
      description: 'Create stunning visual content and designs',
      icon: 'palette',
      backgroundColor: '#9C27B0',
      tags: ['design', 'illustration', 'photoshop', 'ui', 'ux', 'branding'],
      slug: slugify('Graphic Designing', { lower: true, strict: true })
    }
  ];

  // Create categories
  const createdCategories = await Category.insertMany(categories);
  console.log(`Created ${createdCategories.length} categories`);

  // Create subcategories with proper category references
  const categoryMap = {};
  createdCategories.forEach(category => {
    categoryMap[category.name] = category._id;
  });

  const subcategories = [
    // Web Development subcategories
    {
      name: 'Frontend Development',
      description: 'Build user interfaces with HTML, CSS, and JavaScript',
      icon: 'html',
      categoryId: categoryMap['Web Development'],
      slug: slugify('Frontend Development', { lower: true, strict: true })
    },
    {
      name: 'Backend Development',
      description: 'Create server-side applications and APIs',
      icon: 'server',
      categoryId: categoryMap['Web Development'],
      slug: slugify('Backend Development', { lower: true, strict: true })
    },
    {
      name: 'Full Stack Development',
      description: 'Master both frontend and backend technologies',
      icon: 'code',
      categoryId: categoryMap['Web Development'],
      slug: slugify('Full Stack Development', { lower: true, strict: true })
    },
    
    // App Development subcategories
    {
      name: 'Android Development',
      description: 'Build applications for Android devices',
      icon: 'android',
      categoryId: categoryMap['App Development'],
      slug: slugify('Android Development', { lower: true, strict: true })
    },
    {
      name: 'iOS Development',
      description: 'Create applications for Apple devices',
      icon: 'apple',
      categoryId: categoryMap['App Development'],
      slug: slugify('iOS Development', { lower: true, strict: true })
    },
    {
      name: 'Cross-Platform Development',
      description: 'Build apps that work on multiple platforms',
      icon: 'devices',
      categoryId: categoryMap['App Development'],
      slug: slugify('Cross-Platform Development', { lower: true, strict: true })
    },
    
    // Digital Marketing subcategories
    {
      name: 'Search Engine Optimization',
      description: 'Improve website visibility in search engines',
      icon: 'search',
      categoryId: categoryMap['Digital Marketing'],
      slug: slugify('Search Engine Optimization', { lower: true, strict: true })
    },
    {
      name: 'Social Media Marketing',
      description: 'Promote brands and content on social platforms',
      icon: 'share',
      categoryId: categoryMap['Digital Marketing'],
      slug: slugify('Social Media Marketing', { lower: true, strict: true })
    },
    {
      name: 'Content Marketing',
      description: 'Create and distribute valuable content',
      icon: 'article',
      categoryId: categoryMap['Digital Marketing'],
      slug: slugify('Content Marketing', { lower: true, strict: true })
    },
    
    // Graphic Designing subcategories
    {
      name: 'UI/UX Design',
      description: 'Create user-friendly interfaces',
      icon: 'devices',
      categoryId: categoryMap['Graphic Designing'],
      slug: slugify('UI/UX Design', { lower: true, strict: true })
    },
    {
      name: 'Brand Identity Design',
      description: 'Create visual elements that represent brands',
      icon: 'brush',
      categoryId: categoryMap['Graphic Designing'],
      slug: slugify('Brand Identity Design', { lower: true, strict: true })
    },
    {
      name: 'Motion Graphics',
      description: 'Bring designs to life with animation',
      icon: 'movie',
      categoryId: categoryMap['Graphic Designing'],
      slug: slugify('Motion Graphics', { lower: true, strict: true })
    }
  ];

  const createdSubcategories = await Subcategory.insertMany(subcategories);
  console.log(`Created ${createdSubcategories.length} subcategories`);

  return { categories: createdCategories, subcategories: createdSubcategories };
};

// Create users (admin, instructors, students, and events)
const createUsers = async (categories, subcategories) => {
  console.log('Creating users...');
  
  // Create admin user with password
  const adminFirstName = 'Mohjay';
  const adminLastName = 'Infotech';
  const admin = {
    name: `${adminFirstName} ${adminLastName}`,
    email: 'admin@example.com', // Keeping the same email for consistency
    password: await bcrypt.hash('admin123', 10),
    phoneNumber: generateIndianMobile(),
    role: 'admin',
    bio: 'System administrator',
    isActive: true,
    isVerified: true
  };
  
  const createdAdmin = await User.create(admin);
  console.log('Created admin user');
  
  // Create instructors
  const instructors = [];
  for (let i = 0; i < 5; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const phone = generateIndianMobile();
    const state = faker.helpers.arrayElement(indianStates);
    const city = faker.helpers.arrayElement(indianCities);
    
    // Generate random availability slots for each day of the week
    const availabilitySlots = [];
    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    // Each instructor will have 3-5 availability slots
    const slotCount = randomNumber(3, 5);
    for (let j = 0; j < slotCount; j++) {
      const day = faker.helpers.arrayElement(daysOfWeek);
      
      // Generate start time between 8 AM and 5 PM
      const startHour = randomNumber(8, 17);
      const startMinute = faker.helpers.arrayElement([0, 30]);
      const startTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
      
      // End time is 1-3 hours after start time
      const endHour = Math.min(startHour + randomNumber(1, 3), 21);
      const endMinute = faker.helpers.arrayElement([0, 30]);
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
      
      availabilitySlots.push({
        dayOfWeek: day,
        startTime,
        endTime,
        isActive: true
      });
    }
    
    // Select random interests
    const randomCategories = getRandomItems(categories, randomNumber(1, 3));
    const matchingSubcategories = subcategories.filter(sub => 
      randomCategories.some(cat => cat._id.toString() === sub.categoryId.toString())
    );
    const randomSubcategories = getRandomItems(matchingSubcategories, randomNumber(2, 5));
    instructors.push({
      name: `${firstName} ${lastName}`,
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      password: '', // No password for non-admin users
      phoneNumber: phone, // Using the same phone number for both fields
      role: 'instructor',
      bio: faker.lorem.paragraph(),
      avatar: faker.image.avatar(),
      dob: faker.date.birthdate({ min: 25, max: 65, mode: 'age' }).toISOString().split('T')[0],
      state,
      city,
      address: faker.location.streetAddress(),
      isVerified: true,
      isActive: true,
      availabilitySlots,
      notificationPreferences: {
        session: faker.datatype.boolean(),
        messages: faker.datatype.boolean(),
        feedBack: faker.datatype.boolean(),
        newEnrollments: faker.datatype.boolean(),
        reviews: faker.datatype.boolean()
      },
      interests: { categories: [], subcategories: [] },
      isInterestsSet: true,
      // OTP related fields
      otpHash: null,
      otpExpiry: null,
      otpAttempts: 0
    });
  }

  const createdInstructors = await User.insertMany(instructors);
  console.log(`Created ${createdInstructors.length} instructors`);

  // Create event organizers
  const eventUsers = [];
  for (let i = 0; i < 5; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const phone = generateIndianMobile();
    const state = faker.helpers.arrayElement(indianStates);
    const city = faker.helpers.arrayElement(indianCities);
    
    eventUsers.push({
      name: `${firstName} ${lastName}`,
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      password: '', // No password for non-admin users
      phoneNumber: phone,
      role: 'event',
      bio: `Professional event organizer specializing in ${faker.helpers.arrayElement(['tech conferences', 'workshops', 'seminars', 'hackathons', 'bootcamps', 'webinars'])}`,
      avatar: faker.image.avatar(),
      dob: faker.date.birthdate({ min: 25, max: 50, mode: 'age' }).toISOString().split('T')[0],
      state,
      city,
      address: faker.location.streetAddress(),
      isVerified: true,
      isActive: true,
      notificationPreferences: {
        session: true,
        messages: true,
        feedBack: true,
        newEnrollments: true
      },
      // OTP related fields
      otpHash: null,
      otpExpiry: null,
      otpAttempts: 0
    });
  }

  const createdEventUsers = await User.insertMany(eventUsers);
  console.log(`Created ${createdEventUsers.length} event users`);

  // Create students
  const students = [];
  for (let i = 0; i < 10; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const phone = generateIndianMobile();
    const state = faker.helpers.arrayElement(indianStates);
    const city = faker.helpers.arrayElement(indianCities);
    const college = faker.helpers.arrayElement(indianColleges);
    
    // Select random interests
    const randomCategories = getRandomItems(categories, randomNumber(1, 3));
    const categoryIds = randomCategories.map(cat => cat._id);
    
    const matchingSubcategories = subcategories.filter(sub => 
      randomCategories.some(cat => cat._id.toString() === sub.categoryId.toString())
    );
    const randomSubcategories = getRandomItems(matchingSubcategories, randomNumber(2, 5));
    const subcategoryIds = randomSubcategories.map(sub => sub._id);
    
    students.push({
      name: `${firstName} ${lastName}`,
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      password: '', // No password for non-admin users
      phoneNumber: phone, // Using the same phone number for both fields
      role: 'student',
      bio: faker.lorem.paragraph(),
      avatar: faker.image.avatar(),
      dob: faker.date.birthdate({ min: 18, max: 40, mode: 'age' }).toISOString().split('T')[0],
      state,
      city,
      college,
      studentId: `STU${faker.string.alphanumeric(8).toUpperCase()}`,
      address: faker.location.streetAddress(),
      isVerified: true,
      isActive: true,
      notificationPreferences: {
        session: faker.datatype.boolean(),
        messages: faker.datatype.boolean(),
        feedBack: faker.datatype.boolean()
      },
      interests: {
        categories: categoryIds,
        subcategories: subcategoryIds
      },
      isInterestsSet: true,
      // OTP related fields
      otpHash: null,
      otpExpiry: null,
      otpAttempts: 0
    });
  }

  const createdStudents = await User.insertMany(students);
  console.log(`Created ${createdStudents.length} students`);

  return { 
    admin: createdAdmin, 
    adminFirstName, 
    adminLastName, 
    instructors: createdInstructors, 
    eventUsers: createdEventUsers, 
    students: createdStudents 
  };
};

// Create courses with sections, videos, and reviews
const createCourses = async (categories, subcategories, instructors, students) => {
  console.log('Creating courses...');
  
  // Define realistic course titles for each category
  const courseTitles = {
    'Web Development': [
      'Complete Web Development Bootcamp',
      'Modern JavaScript for Beginners',
      'Advanced React & Redux',
      'MERN Stack Masterclass',
      'Professional WordPress Development'
    ],
    'App Development': [
      'Android App Development with Kotlin',
      'iOS Development with Swift',
      'Flutter & Dart: Cross-Platform Apps',
      'React Native for Mobile Developers',
      'Firebase for Mobile Applications'
    ],
    'Digital Marketing': [
      'Digital Marketing Masterclass',
      'SEO Strategies for 2025',
      'Social Media Marketing Excellence',
      'Content Marketing: Strategy to Execution',
      'Google Ads & Analytics for Beginners'
    ],
    'Graphic Designing': [
      'Adobe Photoshop Masterclass',
      'UI/UX Design Principles',
      'Logo Design: From Concept to Completion',
      'Motion Graphics with After Effects',
      'Figma for UI Designers'
    ]
  };
  
  const courses = [];
  
  // Course difficulty levels
  const levels = ['beginner', 'intermediate', 'advanced'];
  
  // Create 15 courses (3-4 per category)
  let courseCount = 0;
  
  // Iterate through each category to ensure even distribution
  for (const category of categories) {
    const categoryName = category.name;
    const availableTitles = [...courseTitles[categoryName]];
    
    // Number of courses to create for this category
    const numCoursesForCategory = categoryName === 'Web Development' ? 4 : 3;
    
    for (let i = 0; i < numCoursesForCategory && courseCount < 15; i++) {
      // Get matching subcategories for this category
      const matchingSubcategories = subcategories.filter(
        sub => sub.categoryId.toString() === category._id.toString()
      );
      const randomSubcategory = faker.helpers.arrayElement(matchingSubcategories);
      
      // Select random instructor
      const randomInstructor = faker.helpers.arrayElement(instructors);
      
      // Get a course title and remove it from available titles
      const titleIndex = Math.min(i, availableTitles.length - 1);
      const courseTitle = availableTitles.splice(titleIndex, 1)[0];
      
      // Generate sections with videos
      const sectionCount = randomNumber(3, 5);
      const sections = [];
      
      // Create section titles based on course content
      const sectionTitles = [];
      if (categoryName === 'Web Development') {
        sectionTitles.push('HTML & CSS Fundamentals', 'JavaScript Essentials', 'Backend Development', 'Database Integration', 'Deployment & DevOps');
      } else if (categoryName === 'App Development') {
        sectionTitles.push('UI Design Fundamentals', 'App Architecture', 'Data Management', 'API Integration', 'Publishing Your App');
      } else if (categoryName === 'Digital Marketing') {
        sectionTitles.push('Marketing Strategy', 'Content Creation', 'Analytics & Tracking', 'Campaign Optimization', 'ROI Measurement');
      } else if (categoryName === 'Graphic Designing') {
        sectionTitles.push('Design Principles', 'Color Theory', 'Typography', 'Layout Design', 'Portfolio Building');
      }
      
      for (let j = 0; j < sectionCount; j++) {
        const videoCount = randomNumber(3, 6);
        const videos = [];
        
        // Create video titles based on section content
        const sectionTitle = sectionTitles[j % sectionTitles.length];
        const videoTitles = [];
        
        if (sectionTitle === 'HTML & CSS Fundamentals') {
          videoTitles.push('HTML Document Structure', 'CSS Selectors & Properties', 'Responsive Design with Flexbox', 'CSS Grid Layout', 'CSS Variables & Custom Properties', 'Building a Responsive Landing Page');
        } else if (sectionTitle === 'JavaScript Essentials') {
          videoTitles.push('Variables & Data Types', 'Functions & Scope', 'DOM Manipulation', 'Event Handling', 'Asynchronous JavaScript', 'ES6+ Features');
        } else if (sectionTitle.includes('Design')) {
          videoTitles.push('Understanding User Needs', 'Wireframing Basics', 'Color Psychology', 'Typography Selection', 'Visual Hierarchy', 'Design Systems');
        } else {
          // Generic video titles for other sections
          videoTitles.push('Introduction to ' + sectionTitle, 'Core Concepts', 'Best Practices', 'Practical Examples', 'Advanced Techniques', 'Case Studies');
        }
        
        for (let k = 0; k < videoCount; k++) {
          videos.push({
            id: faker.string.uuid(),
            title: videoTitles[k % videoTitles.length],
            description: faker.lorem.paragraph(),
            url: `https://example.com/videos/${faker.string.alphanumeric(10)}`,
            durationSeconds: randomNumber(600, 1800), // 10-30 minutes
            order: k + 1
          });
        }
        
        sections.push({
          id: faker.string.uuid(),
          title: sectionTitle,
          description: `Learn all about ${sectionTitle.toLowerCase()} with practical examples and exercises.`,
          order: j + 1,
          videos
        });
      }
      
      // Generate course ratings
      const ratings = [];
      const randomStudentsForRating = getRandomItems(students, Math.min(5, students.length));
      
      // Realistic reviews based on rating
      const positiveReviews = [
        "This course exceeded my expectations! The instructor explains complex concepts in a simple way that's easy to understand. Highly recommended for anyone looking to learn this subject.",
        "Excellent content and well-structured lessons. I've learned so much in a short time and have already started applying these skills in my work.",
        "The instructor's teaching style is engaging and the course materials are comprehensive. I particularly enjoyed the practical exercises and real-world examples.",
        "One of the best courses I've taken on this platform. Clear explanations, good pace, and valuable insights throughout. Worth every penny!",
        "Great course with in-depth content. The instructor is knowledgeable and responsive to questions. The projects helped solidify my understanding.",
        "Very informative and practical. I appreciate how the instructor breaks down complex topics into manageable chunks. The course has definitely improved my skills.",
        "This course provided exactly what I needed to advance in my career. The content is up-to-date and relevant to current industry standards.",
        "I'm impressed with the quality of instruction and course materials. The instructor clearly has extensive experience in the field and shares valuable insights."
      ];
      
      const averageReviews = [
        "Good course with useful information. Some sections could be more detailed, but overall I learned what I needed to know.",
        "Solid content and clear explanations. A few more examples would have been helpful, but I still gained valuable knowledge.",
        "The course meets expectations and covers the fundamentals well. Some advanced topics could be explained better, but it's good for beginners.",
        "Decent course that provides a good introduction to the subject. I would have liked more practical exercises, but the theory is well-explained.",
        "The instructor knows the subject well. Some sections feel rushed, but the course provides a good foundation to build upon."
      ];
      
      for (const student of randomStudentsForRating) {
        const rating = randomNumber(3, 5);
        let review = '';
        
        // Select appropriate review based on rating
        if (rating >= 4) {
          review = faker.helpers.arrayElement(positiveReviews);
        } else {
          review = faker.helpers.arrayElement(averageReviews);
        }
        
        ratings.push({
          user: student._id,
          rating: rating,
          review: review,
          createdAt: faker.date.past({ years: 1 })
        });
      }
      
      // Calculate average rating
      const avgRating = ratings.length > 0 ? 
        ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : 
        4.5; // Default rating if no ratings
      
      // Create course description based on title and category
      let courseDescription = '';
      if (courseTitle.includes('Bootcamp')) {
        courseDescription = `A comprehensive ${categoryName.toLowerCase()} bootcamp that takes you from beginner to professional. Learn all the essential skills, tools, and techniques needed to succeed in the industry. This course includes hands-on projects, coding challenges, and real-world applications.`;
      } else if (courseTitle.includes('Masterclass')) {
        courseDescription = `Take your ${categoryName.toLowerCase()} skills to the next level with this in-depth masterclass. Designed for those who already have basic knowledge and want to advance their expertise with professional techniques and industry best practices.`;
      } else if (courseTitle.includes('Beginners')) {
        courseDescription = `Perfect for absolute beginners in ${categoryName.toLowerCase()}. This course starts from the very basics and gradually builds your knowledge and confidence. No prior experience required - just bring your enthusiasm to learn!`;
      } else {
        courseDescription = `Learn ${courseTitle} from industry experts with years of practical experience. This course combines theoretical knowledge with practical applications to ensure you gain real-world skills that are immediately applicable in your projects or career.`;
      }
      
      // Create course object
      courses.push({
        title: courseTitle,
        description: courseDescription,
        slug: slugify(courseTitle, { lower: true, strict: true }),
        shortDescription: `Master ${courseTitle.toLowerCase()} with this comprehensive course.`,
        price: parseFloat(faker.commerce.price({ min: 1499, max: 9999 })),
        discountPrice: function() {
          return Math.random() > 0.6 ? parseFloat(faker.commerce.price({ min: 999, max: this.price - 500 })) : null;
        }(),
        thumbnail: `https://picsum.photos/seed/${faker.string.alphanumeric(5)}/800/600`,
        demoVideo: `https://example.com/demo/${faker.string.alphanumeric(10)}`,
        level: faker.helpers.arrayElement(levels),
        language: faker.helpers.arrayElement(['English', 'Hindi']),
        category: category._id,
        subcategory: randomSubcategory._id,
        instructor: randomInstructor._id,
        sections,
        ratings,
        averageRating: avgRating,
        totalStudents: randomNumber(50, 500),
        published: true,
        createdAt: faker.date.past({ years: 1 }),
        updatedAt: faker.date.recent()
      });
      
      courseCount++;
    }
  }
  
  const createdCourses = await Course.insertMany(courses);
  console.log(`Created ${createdCourses.length} courses`);
  
  // Update instructors with their courses
  for (const course of createdCourses) {
    await User.findByIdAndUpdate(
      course.instructor,
      { $push: { coursesCreated: course._id } }
    );
  }
  
  // Enroll students in random courses
  for (const student of students) {
    const coursesToEnroll = getRandomItems(createdCourses, randomNumber(1, 5));
    
    const enrolledCourses = coursesToEnroll.map(course => {
      // Generate random completed videos
      const completedVideos = [];
      const progress = randomNumber(0, 100);
      
      // If progress is more than 0, add some completed videos
      if (progress > 0) {
        course.sections.forEach(section => {
          section.videos.forEach(video => {
            if (Math.random() < progress/100) {
              completedVideos.push(video.id);
            }
          });
        });
      }
      
      return {
        course: course._id,
        enrolledAt: faker.date.recent({ days: 60 }),
        progress,
        completedVideos,
        lastAccessed: faker.date.recent({ days: 30 })
      };
    });
    
    await User.findByIdAndUpdate(
      student._id,
      { $set: { enrolledCourses } }
    );
    
    // Update course enrollment counts
    for (const course of coursesToEnroll) {
      await Course.findByIdAndUpdate(
        course._id,
        { $push: { enrolledStudents: student._id } }
      );
    }
  }
  
  return createdCourses;
};

// Create events
const createEvents = async (categories, eventUsers, students) => {
  console.log('Creating events...');
  
  // Define realistic event titles and types
  const eventTypes = [
    {
      category: 'Web Development',
      titles: [
        'Web Development Hackathon 2025',
        'Frontend Masters Workshop',
        'Backend Development Conference',
        'JavaScript Meetup'
      ]
    },
    {
      category: 'App Development',
      titles: [
        'Mobile App Development Summit',
        'Flutter Developer Days',
        'iOS App Workshop',
        'Cross-Platform Development Bootcamp'
      ]
    },
    {
      category: 'Digital Marketing',
      titles: [
        'Digital Marketing Summit 2025',
        'SEO Masterclass Workshop',
        'Social Media Strategy Conference',
        'Content Creation Bootcamp'
      ]
    },
    {
      category: 'Graphic Designing',
      titles: [
        'Design Thinking Workshop',
        'UI/UX Conference 2025',
        'Adobe Creative Suite Masterclass',
        'Brand Identity Design Summit'
      ]
    }
  ];
  
  const events = [];
  const eventFormats = ['online', 'offline', 'hybrid'];
  
  // Create 2-3 events per category
  for (const eventType of eventTypes) {
    const categoryName = eventType.category;
    const category = categories.find(cat => cat.name === categoryName);
    
    // Get event organizers for this category
    const availableEventUsers = [...eventUsers];
    
    // Create 2-3 events for this category
    const numEvents = randomNumber(2, 3);
    
    for (let i = 0; i < numEvents; i++) {
      // Select random event organizer
      const eventOrganizer = faker.helpers.arrayElement(availableEventUsers);
      
      // Get a event title
      const eventTitle = eventType.titles[i % eventType.titles.length];
      
      // Generate event dates
      const now = new Date();
      const futureDate = new Date(now);
      futureDate.setDate(futureDate.getDate() + randomNumber(30, 90)); // Event in 1-3 months
      
      const startDate = futureDate;
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + randomNumber(1, 3)); // 1-3 day event
      
      const registrationDeadline = new Date(startDate);
      registrationDeadline.setDate(startDate.getDate() - 7); // Registration closes 7 days before
      
      // Format times
      const startTime = `${randomNumber(9, 10)}:00`; // 9 or 10 AM
      const endTime = `${randomNumber(16, 18)}:00`; // 4-6 PM
      
      // Generate event description
      let eventDescription = '';
      if (eventTitle.includes('Hackathon')) {
        eventDescription = `Join us for an exciting ${categoryName} hackathon where you'll collaborate with other developers to build innovative solutions. Prizes for the top teams! This is a great opportunity to network with industry professionals and showcase your skills.`;
      } else if (eventTitle.includes('Workshop')) {
        eventDescription = `A hands-on workshop focused on practical ${categoryName} skills. Bring your laptop and be ready to learn by doing. Our expert instructors will guide you through real-world examples and exercises.`;
      } else if (eventTitle.includes('Conference')) {
        eventDescription = `The premier ${categoryName} conference of the year featuring keynote speakers, panel discussions, and networking opportunities. Stay up-to-date with the latest trends and innovations in the industry.`;
      } else if (eventTitle.includes('Summit')) {
        eventDescription = `An immersive ${categoryName} summit bringing together industry leaders and innovators. Participate in discussions about the future of the field and expand your professional network.`;
      } else {
        eventDescription = `A ${categoryName} event designed to help you enhance your skills and connect with like-minded professionals. Whether you're a beginner or experienced, you'll find valuable content and opportunities.`;
      }
      
      // Create event object
      events.push({
        category: categoryName,
        title: eventTitle,
        description: eventDescription,
        slug: slugify(eventTitle, { lower: true, strict: true }),
        contact_phone: faker.phone.number('+91 #### ######'),
        contact_email: faker.internet.email({ firstName: eventOrganizer.name.split(' ')[0], lastName: 'events', provider: 'example.com' }).toLowerCase(),
        location: eventTitle.includes('Online') ? 'Virtual Event' : faker.helpers.arrayElement(['Taj Convention Center, Delhi', 'Tech Hub, Bangalore', 'Innovation Center, Mumbai', 'Digital Park, Hyderabad', 'IT Park, Pune']),
        eventType: faker.helpers.arrayElement(eventFormats),
        startDate: startDate,
        startTime: startTime,
        endDate: endDate,
        endTime: endTime,
        registrationDeadline: registrationDeadline,
        maxParticipants: randomNumber(50, 200),
        price: Math.random() > 0.3 ? randomNumber(499, 2999) : 0, // 30% chance of free event
        tags: [categoryName, ...eventTitle.toLowerCase().split(' ').filter(word => word.length > 3)],
        images: [`https://picsum.photos/seed/${faker.string.alphanumeric(5)}/800/600`],
        createdBy: eventOrganizer._id,
        isActive: true
      });
    }
  }
  
  const createdEvents = await Event.insertMany(events);
  console.log(`Created ${createdEvents.length} events`);
  
  // Enroll random students in events
  for (const event of createdEvents) {
    // Select random students to enroll (30-70% of all students)
    const enrollmentCount = Math.floor(students.length * (randomNumber(30, 70) / 100));
    const studentsToEnroll = getRandomItems(students, enrollmentCount);
    
    const enrollments = studentsToEnroll.map(student => ({
      student: student._id,
      status: faker.helpers.arrayElement(['pending', 'approved', 'approved', 'approved']), // 75% chance of approved
      requestedAt: faker.date.recent(30),
      updatedAt: faker.date.recent(15)
    }));
    
    await Event.findByIdAndUpdate(
      event._id,
      { $set: { enrollments } }
    );
  }
  
  return createdEvents;
};

// Create groups and messages
const createGroupsAndMessages = async (admin, instructors, eventUsers, students, courses, events) => {
  console.log('Creating groups and messages...');
  
  const groups = [];
  
  // Create one group per course
  for (const course of courses) {
    const instructor = await User.findById(course.instructor);
    const enrolledStudents = await User.find({
      'enrolledCourses.course': course._id
    });
    
    if (enrolledStudents.length === 0) continue;
    
    groups.push({
      name: `${course.title} Discussion Group`,
      description: `Group for discussing ${course.title}`,
      category: 'Course',
      admin: instructor._id,
      instructors: [instructor._id],
      students: enrolledStudents.map(student => student._id)
    });
  }
  
  // Create one group per event
  for (const event of events) {
    const eventOrganizer = await User.findById(event.createdBy);
    const enrolledStudents = event.enrollments
      .filter(enrollment => enrollment.status === 'approved')
      .map(enrollment => enrollment.student);
    
    if (enrolledStudents.length === 0) continue;
    
    // For event groups, put event organizer in events array (not instructors)
    groups.push({
      name: `${event.title} Participants Group`,
      description: `Group for participants of ${event.title}`,
      category: 'Event',
      admin: admin._id, // Admin is the platform admin
      instructors: [], // No instructors in event groups initially
      students: enrolledStudents,
      events: [eventOrganizer._id] // Event organizer goes in events array
    });
  }
  
  // Create a few general groups
  groups.push({
    name: 'Platform Announcements',
    description: 'Official announcements from the platform administrators',
    category: 'General',
    admin: admin._id,
    instructors: [admin._id, ...instructors.map(i => i._id), ...eventUsers.map(e => e._id)],
    students: students.map(s => s._id)
  });
  
  groups.push({
    name: 'Instructors Lounge',
    description: 'Private group for instructors to collaborate',
    category: 'Staff',
    admin: admin._id,
    instructors: [admin._id, ...instructors.map(i => i._id)],
    students: []
  });
  
  groups.push({
    name: 'Event Organizers Network',
    description: 'Collaboration space for event organizers',
    category: 'Staff',
    admin: admin._id,
    instructors: [], // No instructors in this group
    students: [],
    events: eventUsers.map(e => e._id) // Event organizers go in events array
  });
  
  // Create mixed groups with different role combinations
  groups.push({
    name: 'Tech Community Hub',
    description: 'A community for all tech enthusiasts - students, instructors, and event organizers',
    category: 'Community',
    admin: admin._id,
    instructors: instructors.slice(0, 3).map(i => i._id), // First 3 instructors
    students: students.slice(0, 5).map(s => s._id), // First 5 students
    events: eventUsers.slice(0, 2).map(e => e._id) // First 2 event organizers
  });
  
  groups.push({
    name: 'Career Development Group',
    description: 'Group for career guidance and networking',
    category: 'Community',
    admin: admin._id,
    instructors: instructors.slice(2, 5).map(i => i._id), // Last 3 instructors
    students: students.slice(5, 10).map(s => s._id), // Last 5 students
    events: eventUsers.slice(2, 4).map(e => e._id) // Last 2 event organizers
  });
  
  const createdGroups = await Group.insertMany(groups);
  console.log(`Created ${createdGroups.length} groups`);
  
  // Create messages for each group
  const messages = [];
  
  for (const group of createdGroups) {
    const messageCount = randomNumber(5, 15);
    
    // Determine who can send messages based on group type and role permissions
    let messageSenders = [group.admin]; // Admin can always send messages
    
    // Add instructors as message senders
    if (group.instructors && group.instructors.length > 0) {
      messageSenders.push(...group.instructors);
    }
    
    // Add event organizers as message senders
    if (group.events && group.events.length > 0) {
      messageSenders.push(...group.events);
    }
    
    // For community groups, allow some students to send messages too
    if (group.category === 'Community' && group.students && group.students.length > 0) {
      // Allow 30% of students in community groups to send messages
      const activeStudents = group.students.slice(0, Math.ceil(group.students.length * 0.3));
      messageSenders.push(...activeStudents);
    }
    
    // Remove duplicates
    messageSenders = [...new Set(messageSenders.map(id => id.toString()))].map(id => new mongoose.Types.ObjectId(id));
    
    // Fetch all user names in one query to avoid multiple DB calls
    const allMemberIds = [...messageSenders, ...group.students, ...(group.events || [])].map(id => id.toString());
    const memberIds = [...new Set(allMemberIds)];
    const memberUsers = await User.find({ _id: { $in: memberIds } }).select('_id name role');
    const userNameMap = {};
    const userRoleMap = {};
    memberUsers.forEach(user => {
      userNameMap[user._id.toString()] = user.name;
      userRoleMap[user._id.toString()] = user.role;
    });
    
    // Generate messages with timestamps over the past month
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    for (let i = 0; i < messageCount; i++) {
      // Only allow admin, instructors, and event users to send messages
      const sender = faker.helpers.arrayElement(messageSenders);
      const senderId = sender.toString();
      const senderRole = userRoleMap[senderId];
      const messageTime = faker.date.between({ from: oneMonthAgo, to: now });
      
      // Determine who has read the message
      const readBy = [];
      const allMembers = [...messageSenders, ...group.students];
      for (const member of allMembers) {
        if (member.toString() !== senderId && Math.random() > 0.3) {
          readBy.push({
            userId: member,
            readAt: faker.date.between({ from: messageTime, to: now })
          });
        }
      }
      
      // Generate appropriate message content based on group type and sender role
      let content = '';
      
      if (group.name.includes('Discussion Group')) {
        if (senderRole === 'instructor') {
          content = faker.helpers.arrayElement([
            `I've uploaded the assignment for this week. Please check the course materials.`,
            `Great questions in today's session! I'll post additional resources soon.`,
            `Remember, the deadline for the project submission is next Friday.`,
            `I'll be hosting office hours this Thursday from 2-4 PM for any questions.`,
            `Excellent work on the recent assignments, everyone!`
          ]);
        } else {
          content = faker.helpers.arrayElement([
            `Has anyone completed the assignment for section 3?`,
            `I found this helpful resource related to our current topic: https://example.com/resource`,
            `Could someone explain the concept we covered in the last lecture?`,
            `Just wanted to share my project progress with everyone!`,
            `When is the next live session scheduled?`
          ]);
        }
      } else if (group.name.includes('Participants Group')) {
        if (senderRole === 'event') {
          content = faker.helpers.arrayElement([
            `Don't forget to bring your laptops to the event!`,
            `We've updated the schedule. Please check your email for details.`,
            `Looking forward to meeting everyone at the event!`,
            `Please fill out the pre-event survey sent to your email.`,
            `The venue has been confirmed. See you all there!`
          ]);
        } else {
          content = faker.helpers.arrayElement([
            `Excited to attend this event! Any preparation needed?`,
            `Does anyone need help with transportation to the venue?`,
            `Looking forward to networking with everyone!`,
            `Will there be recording available for those who can't attend?`,
            `Thanks for organizing this event!`
          ]);
        }
      } else if (group.name === 'Platform Announcements') {
        content = faker.helpers.arrayElement([
          `We're excited to announce new courses launching next week!`,
          `The platform will be undergoing maintenance this weekend.`,
          `Congratulations to our students who completed their certifications this month!`,
          `We've updated our mobile app with new features.`,
          `Don't miss our upcoming webinar series starting next month.`
        ]);
      } else if (group.category === 'Community') {
        if (senderRole === 'instructor') {
          content = faker.helpers.arrayElement([
            `I'm happy to answer any questions about career development in tech.`,
            `Here's a great opportunity for internships I wanted to share.`,
            `Industry trends show that these skills are in high demand right now.`,
            `I'll be mentoring students interested in advanced topics.`
          ]);
        } else if (senderRole === 'event') {
          content = faker.helpers.arrayElement([
            `We're organizing a networking event next month. Stay tuned!`,
            `Great to see so many passionate learners in this community.`,
            `I'll be sharing some industry insights in our upcoming workshop.`,
            `Looking for volunteers to help with our next tech meetup.`
          ]);
        } else {
          content = faker.helpers.arrayElement([
            `Thanks for creating this supportive community!`,
            `Does anyone have experience with remote work opportunities?`,
            `I'd love to connect with others working on similar projects.`,
            `Grateful for all the learning resources shared here.`
          ]);
        }
      } else {
        content = faker.helpers.arrayElement([
          `Great to be part of this group!`,
          `Looking forward to collaborating with everyone.`,
          `Thanks for the warm welcome to the community.`,
          `Excited to learn and share knowledge here.`
        ]);
      }
      
      messages.push({
        groupId: group._id,
        senderId: sender,
        senderName: userNameMap[senderId],
        content: content,
        isEncrypted: false,
        messageType: 'text',
        readBy,
        createdAt: messageTime,
        updatedAt: messageTime
      });
    }
  }
  
  const createdMessages = await Message.insertMany(messages);
  console.log(`Created ${createdMessages.length} messages`);
  
  return { groups: createdGroups, messages: createdMessages };
};

// Helper function to generate realistic assessment feedback based on score
const generateAssessmentFeedback = (score) => {
  if (score >= 90) {
    return `Excellent work! Your project demonstrates a thorough understanding of the concepts covered in this course. Your implementation is well-structured and shows attention to detail. The documentation is clear and comprehensive. Keep up the outstanding work!`;
  } else if (score >= 80) {
    return `Very good job on this assessment. Your project shows a solid grasp of the key concepts. The implementation meets most requirements effectively. There are a few minor areas that could be improved, but overall this is strong work.`;
  } else if (score >= 70) {
    return `Good effort on this project. You've demonstrated understanding of the core concepts, though there are some areas that need improvement. Consider revisiting the sections on [specific topic] to strengthen your implementation. Your documentation is adequate but could be more detailed.`;
  } else {
    return `This submission shows basic understanding of the concepts, but needs significant improvement in several areas. The implementation is incomplete and doesn't fully meet the requirements. Please review the course materials, especially the sections on [specific topics], and consider resubmitting after addressing the issues outlined in the course rubric.`;
  }
};

// Create quizzes and assessments
const createQuizzesAndAssessments = async (instructors, students, courses) => {
  console.log('Creating quizzes and assessments...');
  
  // Create 2-3 quizzes
  const quizzes = [];
  const selectedCourses = getRandomItems(courses, 3); // Select 3 random courses for quizzes
  
  for (const course of selectedCourses) {
    const instructor = await User.findById(course.instructor);
    
    // Create quiz with realistic questions based on course category
    const questions = [];
    let questionCount = randomNumber(5, 10);
    
    // Get course category name
    const category = await Category.findById(course.category);
    const categoryName = category.name;
    
    // Generate questions based on category
    if (categoryName === 'Web Development') {
      questions.push(
        {
          question: 'Which HTML tag is used to create a hyperlink?',
          options: ['<link>', '<a>', '<href>', '<url>'],
          rightAnswer: 1 // <a>
        },
        {
          question: 'Which CSS property is used to change the text color?',
          options: ['text-color', 'font-color', 'color', 'foreground-color'],
          rightAnswer: 2 // color
        },
        {
          question: 'Which JavaScript method is used to add an element at the end of an array?',
          options: ['push()', 'append()', 'add()', 'insert()'],
          rightAnswer: 0 // push()
        },
        {
          question: 'What does DOM stand for?',
          options: ['Document Object Model', 'Data Object Model', 'Document Oriented Model', 'Digital Object Model'],
          rightAnswer: 0 // Document Object Model
        },
        {
          question: 'Which of the following is NOT a JavaScript framework/library?',
          options: ['React', 'Angular', 'Django', 'Vue'],
          rightAnswer: 2 // Django
        }
      );
    } else if (categoryName === 'App Development') {
      questions.push(
        {
          question: 'Which programming language is primarily used for iOS development?',
          options: ['Java', 'Kotlin', 'Swift', 'C#'],
          rightAnswer: 2 // Swift
        },
        {
          question: 'What is the name of Google\'s mobile app development framework that uses Dart?',
          options: ['React Native', 'Flutter', 'Xamarin', 'Ionic'],
          rightAnswer: 1 // Flutter
        },
        {
          question: 'Which component is used to store persistent data in Android?',
          options: ['Intent', 'Activity', 'SharedPreferences', 'Fragment'],
          rightAnswer: 2 // SharedPreferences
        },
        {
          question: 'What does APK stand for?',
          options: ['Android Package Kit', 'Application Program Kit', 'Android Program Kernel', 'Application Package Kernel'],
          rightAnswer: 0 // Android Package Kit
        },
        {
          question: 'Which lifecycle method is called when an Android activity is first created?',
          options: ['onStart()', 'onCreate()', 'onResume()', 'onInit()'],
          rightAnswer: 1 // onCreate()
        }
      );
    } else if (categoryName === 'Digital Marketing') {
      questions.push(
        {
          question: 'What does SEO stand for?',
          options: ['Search Engine Optimization', 'Search Engine Outreach', 'System Engine Optimization', 'Search Experience Optimization'],
          rightAnswer: 0 // Search Engine Optimization
        },
        {
          question: 'Which metric measures the percentage of visitors who leave after viewing only one page?',
          options: ['Exit rate', 'Bounce rate', 'Abandonment rate', 'Click-through rate'],
          rightAnswer: 1 // Bounce rate
        },
        {
          question: 'Which social media platform is known for hashtags and short posts?',
          options: ['Facebook', 'LinkedIn', 'Twitter', 'Pinterest'],
          rightAnswer: 2 // Twitter
        },
        {
          question: 'What type of marketing focuses on creating and distributing valuable content?',
          options: ['Outbound marketing', 'Content marketing', 'Direct marketing', 'Affiliate marketing'],
          rightAnswer: 1 // Content marketing
        },
        {
          question: 'Which of these is NOT a common PPC advertising platform?',
          options: ['Google Ads', 'Facebook Ads', 'Twitter Ads', 'Snapchat Stories'],
          rightAnswer: 3 // Snapchat Stories
        }
      );
    } else if (categoryName === 'Graphic Designing') {
      questions.push(
        {
          question: 'Which color model is used for print design?',
          options: ['RGB', 'CMYK', 'HSL', 'HEX'],
          rightAnswer: 1 // CMYK
        },
        {
          question: 'Which Adobe software is primarily used for vector graphics?',
          options: ['Photoshop', 'Illustrator', 'InDesign', 'Lightroom'],
          rightAnswer: 1 // Illustrator
        },
        {
          question: 'What does UI stand for in design?',
          options: ['User Interface', 'User Interaction', 'Universal Interface', 'User Implementation'],
          rightAnswer: 0 // User Interface
        },
        {
          question: 'Which file format supports transparency?',
          options: ['JPG', 'PNG', 'BMP', 'GIF'],
          rightAnswer: 1 // PNG
        },
        {
          question: 'Which principle refers to the arrangement of elements to create a sense of equilibrium?',
          options: ['Contrast', 'Repetition', 'Balance', 'Proximity'],
          rightAnswer: 2 // Balance
        }
      );
    }
    
    // Add some generic questions to reach the desired count
    while (questions.length < questionCount) {
      questions.push({
        question: `Question ${questions.length + 1} for ${course.title}?`,
        options: [
          `Option A for question ${questions.length + 1}`,
          `Option B for question ${questions.length + 1}`,
          `Option C for question ${questions.length + 1}`,
          `Option D for question ${questions.length + 1}`
        ],
        rightAnswer: randomNumber(0, 3)
      });
    }
    
    quizzes.push({
      title: `${course.title} - Knowledge Check Quiz`,
      course: course._id,
      questions: questions,
      timeLimit: 30, // 30 minutes
      isActive: true,
      createdBy: course.instructor
    });
  }
  
  const createdQuizzes = await Quiz.insertMany(quizzes);
  console.log(`Created ${createdQuizzes.length} quizzes`);
  
  // Create quiz results for some students
  const quizResults = [];
  
  for (const quiz of createdQuizzes) {
    // Find enrolled students for this course
    const enrolledStudents = await User.find({
      'enrolledCourses.course': quiz.course
    });
    
    if (enrolledStudents.length === 0) continue;
    
    // Select random students to take the quiz
    const studentsWhoTookQuiz = getRandomItems(enrolledStudents, Math.min(5, enrolledStudents.length));
    
    for (const student of studentsWhoTookQuiz) {
      // Generate answers for each question
      const answers = [];
      let correctCount = 0;
      
      for (let i = 0; i < quiz.questions.length; i++) {
        const question = quiz.questions[i];
        const selectedOption = Math.random() > 0.7 ? question.rightAnswer : randomNumber(0, 3);
        const isCorrect = selectedOption === question.rightAnswer;
        
        if (isCorrect) correctCount++;
        
        answers.push({
          questionIndex: i,
          selectedOption: selectedOption,
          isCorrect: isCorrect
        });
      }
      
      // Calculate score and determine if passed
      const score = correctCount;
      const totalQuestions = quiz.questions.length;
      const passed = (score / totalQuestions) >= 0.6; // 60% passing threshold
      
      // Create start and end times
      const startTime = faker.date.recent(14); // Within last 2 weeks
      const endTime = new Date(startTime.getTime() + randomNumber(10, 25) * 60000); // 10-25 minutes after start
      
      quizResults.push({
        student: student._id,
        quiz: quiz._id,
        course: quiz.course,
        answers: answers,
        startTime: startTime,
        endTime: endTime,
        score: score,
        totalQuestions: totalQuestions,
        passed: passed,
        attempt: 1
      });
    }
  }
  
  const createdQuizResults = await QuizResult.insertMany(quizResults);
  console.log(`Created ${createdQuizResults.length} quiz results`);
  
  // Create 2-3 assessments
  const assessments = [];
  const assessmentCourses = getRandomItems(courses, 3); // Select 3 random courses for assessments
  
  for (const course of assessmentCourses) {
    assessments.push({
      title: `${course.title} - Final Project`,
      description: `Create a comprehensive project demonstrating the skills you've learned in ${course.title}. Submit your completed work along with documentation explaining your approach and implementation details.`,
      course: course._id,
      dueDate: faker.date.future(0.5), // Due within next 6 months
      totalPoints: 100,
      isActive: true,
      createdBy: course.instructor
    });
  }
  
  const createdAssessments = await Assessment.insertMany(assessments);
  console.log(`Created ${createdAssessments.length} assessments`);
  
  // Create assessment results for some students
  const assessmentResults = [];
  
  for (const assessment of createdAssessments) {
    // Find enrolled students for this course
    const enrolledStudents = await User.find({
      'enrolledCourses.course': assessment.course
    });
    
    if (enrolledStudents.length === 0) continue;
    
    // Select random students to submit the assessment
    const studentsWhoSubmitted = getRandomItems(enrolledStudents, Math.min(3, enrolledStudents.length));
    
    for (const student of studentsWhoSubmitted) {
      // Create submission details
      const submittedAt = faker.date.recent(10); // Submitted within last 10 days
      const isGraded = Math.random() > 0.3; // 70% chance of being graded
      
      assessmentResults.push({
        student: student._id,
        assessment: assessment._id,
        course: assessment.course,
        submission: {
          text: `I'm submitting my final project for this course. This project demonstrates the skills I've learned throughout the course, including ${faker.helpers.arrayElement(['responsive design', 'API integration', 'database management', 'user authentication', 'state management', 'performance optimization', 'data visualization', 'mobile-first design'])}.\n\nI've implemented all the required features and added some additional functionality to enhance the user experience. The code is well-structured and follows the best practices taught in the course. I've also included comprehensive documentation explaining my approach and implementation details.\n\nI look forward to your feedback and am happy to answer any questions about my implementation.`,
          fileUrl: `https://example.com/submissions/${faker.string.alphanumeric(10)}.pdf`,
          fileName: 'final_project.pdf',
          fileType: 'application/pdf'
        },
        score: isGraded ? randomNumber(60, 100) : 0, // Score between 60-100 if graded
        feedback: isGraded ? generateAssessmentFeedback(randomNumber(60, 100)) : '',
        submittedAt: submittedAt,
        gradedAt: isGraded ? faker.date.between({ from: submittedAt, to: new Date() }) : null,
        gradedBy: isGraded ? assessment.createdBy : null,
        status: isGraded ? 'graded' : 'submitted'
      });
    }
  }
  
  const createdAssessmentResults = await AssessmentResult.insertMany(assessmentResults);
  console.log(`Created ${createdAssessmentResults.length} assessment results`);
  
  return { 
    quizzes: createdQuizzes, 
    quizResults: createdQuizResults,
    assessments: createdAssessments,
    assessmentResults: createdAssessmentResults
  };
};

// Create notifications
const createNotifications = async (admin, instructors, eventUsers, students, courses, events) => {
  console.log('Creating notifications...');
  
  const notifications = [];
  const now = new Date();
  
  // Create course-related notifications for students
  for (const student of students) {
    // Get courses the student is enrolled in
    const enrolledCourses = await Course.find({
      enrolledStudents: student._id
    }).populate('instructor');
    
    if (enrolledCourses.length > 0) {
      // Course enrollment notifications
      for (const course of enrolledCourses) {
        // Only create for some courses to avoid too many notifications
        if (Math.random() > 0.5) continue;
        
        const enrollmentDate = faker.date.recent(30);
        
        notifications.push({
          recipient: student._id,
          sender: null,
          type: 'course_enrollment',
          title: 'Course Enrollment Confirmed',
          message: `You have been successfully enrolled in ${course.title}. Start learning now!`,
          data: {
            courseId: course._id
          },
          priority: 'medium',
          status: Math.random() > 0.5 ? 'read' : 'unread',
          isRead: Math.random() > 0.5,
          readAt: Math.random() > 0.5 ? faker.date.between({ from: enrollmentDate, to: now }) : null,
          createdAt: enrollmentDate,
          updatedAt: enrollmentDate
        });
        
        // Course update notification
        if (Math.random() > 0.7) {
          const updateDate = faker.date.recent(15);
          
          notifications.push({
            recipient: student._id,
            sender: null,
            type: 'course_updated',
            title: 'Course Content Updated',
            message: `New content has been added to ${course.title}. Check it out!`,
            data: {
              courseId: course._id
            },
            priority: 'medium',
            status: Math.random() > 0.5 ? 'read' : 'unread',
            isRead: Math.random() > 0.5,
            readAt: Math.random() > 0.5 ? faker.date.between({ from: updateDate, to: now }) : null,
            createdAt: updateDate,
            updatedAt: updateDate
          });
        }
      }
    }
    
    // Event-related notifications
    const enrolledEvents = await Event.find({
      'enrollments.student': student._id,
      'enrollments.status': 'approved'
    }).populate('createdBy');
    
    for (const event of enrolledEvents) {
      // Only create for some events to avoid too many notifications
      if (Math.random() > 0.6) continue;
      
      const approvalDate = faker.date.recent(20);
      
      notifications.push({
        recipient: student._id,
        sender: null,
        type: 'event_enrollment_approved',
        title: 'Event Registration Approved',
        message: `Your registration for ${event.title} has been approved. We look forward to seeing you there!`,
        data: {
          eventId: event._id
        },
        priority: 'high',
        status: Math.random() > 0.5 ? 'read' : 'unread',
        isRead: Math.random() > 0.5,
        readAt: Math.random() > 0.5 ? faker.date.between({ from: approvalDate, to: now }) : null,
        createdAt: approvalDate,
        updatedAt: approvalDate
      });
      
      // Event reminder notification (for upcoming events)
      if (event.startDate > now) {
        const reminderDate = new Date(now);
        reminderDate.setDate(now.getDate() - randomNumber(1, 3)); // 1-3 days ago
        
        notifications.push({
          recipient: student._id,
          sender: null,
          type: 'event_reminder',
          title: 'Upcoming Event Reminder',
          message: `Reminder: ${event.title} is starting on ${event.startDate.toLocaleDateString()}. Don't forget to prepare!`,
          data: {
            eventId: event._id
          },
          priority: 'high',
          status: Math.random() > 0.3 ? 'read' : 'unread', // More likely to be read
          isRead: Math.random() > 0.3,
          readAt: Math.random() > 0.3 ? faker.date.between({ from: reminderDate, to: now }) : null,
          createdAt: reminderDate,
          updatedAt: reminderDate
        });
      }
    }
    
    // System announcements (for all students)
    if (Math.random() > 0.5) {
      const announcementDate = faker.date.recent(10);
      
      notifications.push({
        recipient: student._id,
        sender: admin._id,
        type: 'system_announcement',
        title: faker.helpers.arrayElement([
          'Platform Maintenance Notice',
          'New Features Released',
          'Holiday Schedule Update',
          'Important Policy Changes'
        ]),
        message: faker.lorem.paragraph(),
        priority: 'medium',
        status: Math.random() > 0.5 ? 'read' : 'unread',
        isRead: Math.random() > 0.5,
        readAt: Math.random() > 0.5 ? faker.date.between({ from: announcementDate, to: now }) : null,
        createdAt: announcementDate,
        updatedAt: announcementDate
      });
    }
  }
  
  // Create notifications for instructors
  for (const instructor of instructors) {
    // New enrollment notifications
    const instructorCourses = await Course.find({ instructor: instructor._id });
    
    for (const course of instructorCourses) {
      if (Math.random() > 0.7) continue;
      
      const enrollmentDate = faker.date.recent(15);
      
      notifications.push({
        recipient: instructor._id,
        sender: null, // System notification
        type: 'course_enrollment', // Changed from 'new_enrollments' to valid enum value
        title: 'New Course Enrollments',
        message: `You have new students enrolled in ${course.title}. Check your dashboard for details.`,
        data: {
          courseId: course._id,
          customData: {
            enrollmentCount: randomNumber(1, 5)
          }
        },
        priority: 'medium',
        status: Math.random() > 0.6 ? 'read' : 'unread',
        isRead: Math.random() > 0.6,
        readAt: Math.random() > 0.6 ? faker.date.between({ from: enrollmentDate, to: now }) : null,
        createdAt: enrollmentDate,
        updatedAt: enrollmentDate
      });
    }
    
    // Review notifications
    if (Math.random() > 0.5) {
      const reviewDate = faker.date.recent(7);
      
      notifications.push({
        recipient: instructor._id,
        sender: admin._id,
        type: 'general', // Changed from 'reviews' to valid enum value
        title: 'New Course Review',
        message: `A student has left a review on one of your courses. Check it out!`,
        data: {
          courseId: faker.helpers.arrayElement(instructorCourses)._id
        },
        priority: 'medium',
        status: Math.random() > 0.4 ? 'read' : 'unread',
        isRead: Math.random() > 0.4,
        readAt: Math.random() > 0.4 ? faker.date.between({ from: reviewDate, to: now }) : null,
        createdAt: reviewDate,
        updatedAt: reviewDate
      });
    }
  }
  
  // Create notifications for event organizers
  for (const eventUser of eventUsers) {
    const userEvents = await Event.find({ createdBy: eventUser._id });
    
    for (const event of userEvents) {
      if (Math.random() > 0.6) continue;
      
      const enrollmentDate = faker.date.recent(10);
      
      notifications.push({
        recipient: eventUser._id,
        sender: null, // System notification
        type: 'event_enrollment_approved',
        title: 'New Event Registrations',
        message: `You have new participants registered for ${event.title}. Check your dashboard for details.`,
        data: {
          eventId: event._id,
          customData: {
            enrollmentCount: randomNumber(3, 10)
          }
        },
        priority: 'medium',
        status: Math.random() > 0.5 ? 'read' : 'unread',
        isRead: Math.random() > 0.5,
        readAt: Math.random() > 0.5 ? faker.date.between({ from: enrollmentDate, to: now }) : null,
        createdAt: enrollmentDate,
        updatedAt: enrollmentDate
      });
    }
  }
  
  const createdNotifications = await Notification.insertMany(notifications);
  console.log(`Created ${createdNotifications.length} notifications`);
  
  return createdNotifications;
};

// Main function to seed all data
const seedData = async () => {
  try {
    await clearData();
    
    console.log('\n📋 STEP 1: Creating categories and subcategories...');
    const { categories, subcategories } = await createCategories();
    
    console.log('\n👤 STEP 2: Creating users (admin, instructors, events, students)...');
    const { admin, adminFirstName, adminLastName, instructors, eventUsers, students } = await createUsers(categories, subcategories);
    
    console.log('\n📚 STEP 3: Creating courses...');
    const courses = await createCourses(categories, subcategories, instructors, students);
    
    console.log('\n🎫 STEP 4: Creating events...');
    const events = await createEvents(categories, eventUsers, students);
    
    console.log('\n💬 STEP 5: Creating groups and messages...');
    const { groups, messages } = await createGroupsAndMessages(admin, instructors, eventUsers, students, courses, events);
    
    console.log('\n🧪 STEP 6: Creating quizzes and assessments...');
    const { quizzes, quizResults, assessments, assessmentResults } = await createQuizzesAndAssessments(instructors, students, courses);
    
    console.log('\n🔔 STEP 7: Creating notifications...');
    const notifications = await createNotifications(admin, instructors, eventUsers, students, courses, events);
    
    console.log('\n✅ Data seeding completed successfully!');
    console.log('\n======== USER CREDENTIALS ========');
    console.log('\nAdmin login credentials:');
    console.log(`Name: ${adminFirstName} ${adminLastName}`);
    console.log('Email: admin@gmail.com');
    console.log('Password: admin123');
    console.log('\nAll other users (instructors, events, students) use mobile OTP for authentication.');
    
    // Get sample users from each role for testing
    console.log('\n======== SAMPLE USERS FOR TESTING ========');
    
    // Get all instructors
    console.log('\n👨‍🏫 INSTRUCTORS:');
    const allInstructors = await User.find({ role: 'instructor' }).select('name email phoneNumber');
    allInstructors.forEach(instructor => {
      console.log(`Name: ${instructor.name}`);
      console.log(`Email: ${instructor.email}`);
      console.log(`Phone: ${instructor.phoneNumber}`);
      console.log('---');
    });
    
    // Get all event organizers
    console.log('\n🎫 EVENT ORGANIZERS:');
    const allEventUsers = await User.find({ role: 'event' }).select('name email phoneNumber');
    allEventUsers.forEach(eventUser => {
      console.log(`Name: ${eventUser.name}`);
      console.log(`Email: ${eventUser.email}`);
      console.log(`Phone: ${eventUser.phoneNumber}`);
      console.log('---');
    });
    
    // Get all students
    console.log('\n👨‍🎓 STUDENTS:');
    const allStudents = await User.find({ role: 'student' }).select('name email phoneNumber');
    allStudents.forEach(student => {
      console.log(`Name: ${student.name}`);
      console.log(`Email: ${student.email}`);
      console.log(`Phone: ${student.phoneNumber}`);
      console.log('---');
    });
    
    console.log('\nNote: You can also run getUserRolesTable.js to see this information in a formatted table');
    console.log('or run getUserRoles.js to generate a JSON file with this data for the frontend team');
    
    console.log('\n📊 Summary of created data:');
    console.log(`- Categories: ${categories.length}`);
    console.log(`- Subcategories: ${subcategories.length}`);
    console.log(`- Users: ${1 + instructors.length + eventUsers.length + students.length} (1 admin, ${instructors.length} instructors, ${eventUsers.length} event organizers, ${students.length} students)`);
    console.log(`- Courses: ${courses.length}`);
    console.log(`- Events: ${events.length}`);
    console.log(`- Groups: ${groups.length}`);
    console.log(`- Messages: ${messages.length}`);
    console.log(`- Quizzes: ${quizzes.length}`);
    console.log(`- Quiz Results: ${quizResults.length}`);
    console.log(`- Assessments: ${assessments.length}`);
    console.log(`- Assessment Results: ${assessmentResults.length}`);
    console.log(`- Notifications: ${notifications.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

module.exports = { seedData}

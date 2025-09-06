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
  console.log('Data cleared successfully');
};

// Create categories and subcategories
const createCategories = async () => {
  console.log('Creating categories and subcategories...');
  
  const categories = [
    {
      name: 'Web Development',
      description: 'Learn to build modern web applications',
      icon: 'code',
      backgroundColor: '#4CAF50',
      tags: ['programming', 'web', 'frontend', 'backend'],
      slug: slugify('Web Development', { lower: true, strict: true })
    },
    {
      name: 'Data Science',
      description: 'Master data analysis and machine learning',
      icon: 'analytics',
      backgroundColor: '#2196F3',
      tags: ['data', 'analytics', 'machine learning', 'statistics'],
      slug: slugify('Data Science', { lower: true, strict: true })
    },
    {
      name: 'Business',
      description: 'Develop essential business skills',
      icon: 'business',
      backgroundColor: '#FFC107',
      tags: ['management', 'marketing', 'entrepreneurship'],
      slug: slugify('Business', { lower: true, strict: true })
    },
    {
      name: 'Design',
      description: 'Create stunning visual experiences',
      icon: 'palette',
      backgroundColor: '#9C27B0',
      tags: ['ui', 'ux', 'graphic design', 'illustration'],
      slug: slugify('Design', { lower: true, strict: true })
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
    
    // Data Science subcategories
    {
      name: 'Machine Learning',
      description: 'Build intelligent systems that learn from data',
      icon: 'psychology',
      categoryId: categoryMap['Data Science'],
      slug: slugify('Machine Learning', { lower: true, strict: true })
    },
    {
      name: 'Data Analysis',
      description: 'Extract insights from complex datasets',
      icon: 'bar_chart',
      categoryId: categoryMap['Data Science'],
      slug: slugify('Data Analysis', { lower: true, strict: true })
    },
    {
      name: 'Big Data',
      description: 'Work with large-scale data processing',
      icon: 'storage',
      categoryId: categoryMap['Data Science'],
      slug: slugify('Big Data', { lower: true, strict: true })
    },
    
    // Business subcategories
    {
      name: 'Marketing',
      description: 'Promote products and services effectively',
      icon: 'campaign',
      categoryId: categoryMap['Business'],
      slug: slugify('Marketing', { lower: true, strict: true })
    },
    {
      name: 'Entrepreneurship',
      description: 'Start and grow your own business',
      icon: 'lightbulb',
      categoryId: categoryMap['Business'],
      slug: slugify('Entrepreneurship', { lower: true, strict: true })
    },
    {
      name: 'Finance',
      description: 'Manage money and investments',
      icon: 'account_balance',
      categoryId: categoryMap['Business'],
      slug: slugify('Finance', { lower: true, strict: true })
    },
    
    // Design subcategories
    {
      name: 'UI/UX Design',
      description: 'Create user-friendly interfaces',
      icon: 'devices',
      categoryId: categoryMap['Design'],
      slug: slugify('UI/UX Design', { lower: true, strict: true })
    },
    {
      name: 'Graphic Design',
      description: 'Create visual content for various media',
      icon: 'brush',
      categoryId: categoryMap['Design'],
      slug: slugify('Graphic Design', { lower: true, strict: true })
    },
    {
      name: 'Motion Graphics',
      description: 'Bring designs to life with animation',
      icon: 'movie',
      categoryId: categoryMap['Design'],
      slug: slugify('Motion Graphics', { lower: true, strict: true })
    }
  ];

  const createdSubcategories = await Subcategory.insertMany(subcategories);
  console.log(`Created ${createdSubcategories.length} subcategories`);

  return { categories: createdCategories, subcategories: createdSubcategories };
};

// Create users (admin, instructors and students)
const createUsers = async (categories, subcategories) => {
  console.log('Creating users...');
  
  // Create admin user with password
  const admin = {
    name: 'Admin User',
    email: 'admin@example.com',
    password: await bcrypt.hash('admin123', 10),
    phoneNumber: generateIndianMobile(),
    role: 'admin',
    bio: 'System administrator',
    isActive: true
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

  // Create students
  const students = [];
  for (let i = 0; i < 15; i++) {
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

  return { admin: createdAdmin, instructors: createdInstructors, students: createdStudents };
};

// Create courses with sections, videos, and reviews
const createCourses = async (categories, subcategories, instructors, students) => {
  console.log('Creating courses...');
  
  const courses = [];
  
  // Course difficulty levels
  const levels = ['beginner', 'intermediate', 'advanced'];
  
  // Create 15 courses
  for (let i = 0; i < 15; i++) {
    // Select random category and matching subcategory
    const randomCategory = faker.helpers.arrayElement(categories);
    const matchingSubcategories = subcategories.filter(
      sub => sub.categoryId.toString() === randomCategory._id.toString()
    );
    const randomSubcategory = faker.helpers.arrayElement(matchingSubcategories);
    
    // Select random instructor
    const randomInstructor = faker.helpers.arrayElement(instructors);
    
    // Generate sections with videos
    const sectionCount = randomNumber(3, 6);
    const sections = [];
    
    for (let j = 0; j < sectionCount; j++) {
      const videoCount = randomNumber(2, 5);
      const videos = [];
      
      for (let k = 0; k < videoCount; k++) {
        videos.push({
          id: faker.string.uuid(),
          title: faker.lorem.sentence({ min: 3, max: 6 }),
          description: faker.lorem.paragraph(),
          url: `https://example.com/videos/${faker.string.alphanumeric(10)}`,
          durationSeconds: randomNumber(300, 1800), // 5-30 minutes
          order: k + 1
        });
      }
      
      sections.push({
        id: faker.string.uuid(),
        title: `Section ${j + 1}: ${faker.lorem.words({ min: 2, max: 5 })}`,
        description: faker.lorem.paragraph(),
        order: j + 1,
        videos
      });
    }
    
    // Generate course ratings
    const ratings = [];
    const randomStudentsForRating = getRandomItems(students, 10);
    
    for (const student of randomStudentsForRating) {
      ratings.push({
        user: student._id,
        rating: randomNumber(3, 5),
        review: faker.lorem.paragraph(),
        createdAt: faker.date.past({ years: 1 })
      });
    }
    
    // Calculate average rating
    const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
    
    // Create course object
    courses.push({
      title: faker.lorem.words({ min: 3, max: 6 }),
      description: faker.lorem.paragraphs({ min: 2, max: 4 }),
      slug: slugify(faker.lorem.words({ min: 3, max: 6 }), { lower: true, strict: true }),
      shortDescription: faker.lorem.sentence(),
      price: parseFloat(faker.commerce.price({ min: 499, max: 9999 })),
      discountPrice: function() {
        return Math.random() > 0.7 ? parseFloat(faker.commerce.price({ min: 299, max: this.price })) : null;
      }(),
      thumbnail: `https://picsum.photos/seed/${faker.string.alphanumeric(5)}/800/600`,
      demoVideo: `https://example.com/demo/${faker.string.alphanumeric(10)}`,
      level: faker.helpers.arrayElement(levels),
      language: faker.helpers.arrayElement(['English', 'Hindi', 'Spanish']),
      category: randomCategory._id,
      subcategory: randomSubcategory._id,
      instructor: randomInstructor._id,
      sections,
      ratings,
      averageRating:avgRating,
      totalStudents: randomNumber(50, 500),
      published: true,
      createdAt: faker.date.past({ years: 1 }),
      updatedAt: faker.date.recent()
    });
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

// Create groups and messages
const createGroupsAndMessages = async (instructors, students, courses) => {
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
      admin: instructor._id,
      instructors: [instructor._id],
      students: enrolledStudents.map(student => student._id)
    });
  }
  
  // Create a few general groups
  groups.push({
    name: 'General Discussion',
    description: 'Group for general platform discussions',
    admin: instructors[0]._id,
    instructors: instructors.map(i => i._id),
    students: students.map(s => s._id)
  });
  
  groups.push({
    name: 'Technical Support',
    description: 'Get help with technical issues',
    admin: instructors[1]._id,
    instructors: instructors.map(i => i._id),
    students: students.map(s => s._id)
  });
  
  const createdGroups = await Group.insertMany(groups);
  console.log(`Created ${createdGroups.length} groups`);
  
  // Create messages for each group
  const messages = [];
  
  for (const group of createdGroups) {
    const messageCount = randomNumber(15, 30);
    const groupMembers = [
      ...group.instructors,
      ...group.students
    ];
    
    // Fetch all user names in one query to avoid multiple DB calls
    const memberIds = groupMembers.map(id => id.toString());
    const memberUsers = await User.find({ _id: { $in: memberIds } }).select('_id name');
    const userNameMap = {};
    memberUsers.forEach(user => {
      userNameMap[user._id.toString()] = user.name;
    });
    
    // Generate messages with timestamps over the past week
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    for (let i = 0; i < messageCount; i++) {
      const sender = faker.helpers.arrayElement(groupMembers);
      const senderId = sender.toString();
      const messageTime = faker.date.between({ from: oneWeekAgo, to: now });
      
      // Determine who has read the message
      const readBy = [];
      for (const member of groupMembers) {
        if (member.toString() !== senderId && Math.random() > 0.3) {
          readBy.push({
            userId: member,
            readAt: faker.date.between({ from: messageTime, to: now })
          });
        }
      }
      
      messages.push({
        groupId: group._id,
        senderId: sender,
        senderName: userNameMap[senderId],
        content: faker.lorem.paragraph(),
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

// Main function to seed all data
const seedData = async () => {
  try {
    await clearData();
    
    const { categories, subcategories } = await createCategories();
    const { admin, instructors, students } = await createUsers(categories, subcategories);
    const courses = await createCourses(categories, subcategories, instructors, students);
    await createGroupsAndMessages(instructors, students, courses);
    
    console.log('✅ Data seeding completed successfully!');
    console.log('\nAdmin login credentials:');
    console.log('Email: admin@example.com');
    console.log('Password: admin123');
    console.log('\nAll other users (instructors and students) use mobile OTP for authentication.');
    console.log('You can use any of these phone numbers for testing:');
    
    const sampleInstructor = await User.findOne({ role: 'instructor' }).select('name phoneNumber');
    const sampleStudent = await User.findOne({ role: 'student' }).select('name phoneNumber');
    
    console.log(`Sample instructor: ${sampleInstructor.name} (${sampleInstructor.phone})`);
    console.log(`Sample student: ${sampleStudent.name} (${sampleStudent.phone})`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
};

module.exports = { seedData}

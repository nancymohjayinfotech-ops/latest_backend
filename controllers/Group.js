const Group = require('../models/Group');
const User = require('../models/User');
const Message = require('../models/Message');
const { models: messageModels } = require('./Message');
const { createGroupNotification } = require('./Notification');

// Create a new group
const createGroup = async (req, res) => {
  try {
    // Get user to verify role
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    // Allow admin, instructor, and event users to create groups
    if (!['admin', 'instructor', 'event'].includes(user.role)) {
      return res.status(403).json({ 
        success: false,
        message: 'Only admin, instructor, or event users can create groups' 
      });
    }
    
    const groupDoc = {
      name: req.body.name,
      description: req.body.description || '',
      admin: user.role === 'admin' ? req.user.id : null,
      instructors: req.body.instructors || [],
      students: req.body.students || [],
      events: req.body.events || []
    };
    
    // If creator is instructor, add them to instructors array
    if (user.role === 'instructor' && !groupDoc.instructors.includes(req.user.id)) {
      groupDoc.instructors.push(req.user.id);
    }
    
    // If creator is event organizer, add them to events array
    if (user.role === 'event' && !groupDoc.events.includes(req.user.id)) {
      groupDoc.events.push(req.user.id);
    }
    
    const group = new Group(groupDoc);
    await group.save();

    // Create notifications for group creation
    try {
      const allMemberIds = [
        ...(groupDoc.instructors || []),
        ...(groupDoc.students || []),
        ...(groupDoc.events || [])
      ];

      if (allMemberIds.length > 0) {
        await createGroupNotification(group, 'group_created', allMemberIds);
      }
    } catch (notificationError) {
      console.error('Error creating group creation notifications:', notificationError);
      // Don't fail the group creation if notifications fail
    }
    
    res.status(201).json(group);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error creating group',
      error: error.message 
    });
  }
};

const getAllGroups = async (req, res) => {
  try {
    // Extract pagination parameters from query
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const totalGroups = await Group.countDocuments();
    
    // Fetch groups with pagination
    const groups = await Group.find()
      .populate('admin', 'name email avatar')
      .populate('instructors', 'name email avatar')
      .populate('students', 'name email avatar')
      .populate('events', 'name email avatar')
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean() for better performance when adding computed fields

    // Add member count to each group
    const groupsWithMemberCount = groups.map(group => ({
      ...group,
      memberCount: {
        total: (group.instructors?.length || 0) + (group.students?.length || 0) + (group.events?.length || 0),
        instructors: group.instructors?.length || 0,
        students: group.students?.length || 0,
        events: group.events?.length || 0
      }
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalGroups / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      message: 'Groups retrieved successfully',
      data: {
        groups: groupsWithMemberCount,
        pagination: {
          currentPage: page,
          totalPages,
          totalGroups,
          limit,
          hasNextPage,
          hasPrevPage
        }
      }
    });
  } catch (error) {
    console.error('Error getting all groups:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error getting all groups',
      error: error.message 
    });
  }
};

// Get group by ID
const getGroupById = async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId)
      .populate('admin', 'name email avatar')
      .populate('instructors', 'name email avatar')
      .populate('students', 'name email avatar')
      .populate('events', 'name email avatar');
    
    if (!group) {
      return res.status(404).json({ 
        success: false,
        message: 'Group not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      data: group
    });
  } catch (error) {
    console.error('Error getting group by ID:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error getting group by ID',
      error: error.message 
    });
  }
};

// Get all groups for a user (based on their role)
const getGroupsForUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const userDoc = await User.findById(userId);
    
    if (!userDoc) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    let groups = [];
    // Get groups where user is an instructor
    const instructorGroups = await Group.find({  instructors: { $in: [userId] } })
      .populate('admin', 'name email avatar')
      .populate('instructors', 'name email avatar')
      .populate('students', 'name email avatar');
    
    // Avoid duplicates
    instructorGroups.forEach(group => {
      if (!groups.some(g => g._id.toString() === group._id.toString())) {
        groups.push(group);
      }
    });
    
    // Get groups where user is a student
    const studentGroups = await Group.find({ students: { $in: [userId] } })
      .populate('admin', 'name email avatar')
      .populate('instructors', 'name email avatar')
      .populate('students', 'name email avatar')
      .populate('events', 'name email avatar');
    
    // Get groups where user is an event organizer
    const eventGroups = await Group.find({ events: { $in: [userId] } })
      .populate('admin', 'name email avatar')
      .populate('instructors', 'name email avatar')
      .populate('students', 'name email avatar')
      .populate('events', 'name email avatar');
    
    // Avoid duplicates
    studentGroups.forEach(group => {
      if (!groups.some(g => g._id.toString() === group._id.toString())) {
        groups.push(group);
      }
    });
    
    // Avoid duplicates for event groups
    eventGroups.forEach(group => {
      if (!groups.some(g => g._id.toString() === group._id.toString())) {
        groups.push(group);
      }
    });

    // Remove the current user from the student list in each group
    const processedGroups = groups.map(group => {
      // Create a new object to avoid modifying the mongoose document directly
      const processedGroup = group.toObject();
      
      // Filter out the current user from the students array
      if (processedGroup.students && Array.isArray(processedGroup.students)) {
        processedGroup.students = processedGroup.students.filter(student => 
          student._id.toString() !== userId.toString()
        );
      }
      
      return processedGroup;
    });
    
    res.status(200).json({
      success: true,
      groups: processedGroups
    });
  } catch (error) {
    console.error('Error getting groups for user:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error getting groups for user',
      error: error.message 
    });
  }
};

// Add instructor to group (admin only)
const addInstructor = async (req, res) => {
  console.log(req.params);
  try {
    const adminId = req.user.id;
    const groupId = req.params.groupId;
    const instructorId = req.body.instructorId;
    
    const group = await Group.findById(groupId);
    
    if (!group) {
      return res.status(404).json({ 
        success: false,
        message: 'Group not found' 
      });
    }

    if (group.admin.toString() !== adminId.toString()) {
      return res.status(403).json({ 
        success: false,
        message: 'Only the group admin can add instructors' 
      });
    }
    
    // Verify instructor exists
    const instructorDoc = await User.findById(instructorId);
    if (!instructorDoc) {
      return res.status(404).json({ 
        success: false,
        message: 'Instructor user not found' 
      });
    }
    
    // Add instructor to group
    await Group.findByIdAndUpdate(
      groupId,
      { $addToSet: { instructors: instructorId } }
    );
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error adding instructor to group:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error adding instructor to group',
      error: error.message 
    });
  }
};

// Remove instructor from group (admin only)
const removeInstructor = async (req, res) => {
  try {
    const adminId = req.user.id;
    const groupId = req.params.groupId;
    const instructorId = req.params.instructorId;
    
    const group = await Group.findById(groupId);
    
    if (!group) {
      return res.status(404).json({ 
        success: false,
        message: 'Group not found' 
      });
    }
    
    if (group.admin.toString() !== adminId.toString()) {
      return res.status(403).json({ 
        success: false,
        message: 'Only the group admin can remove instructors' 
      });
    }
    
    // Remove instructor from group
    await Group.findByIdAndUpdate(
      groupId,
      { $pull: { instructors: instructorId } }
    );
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error removing instructor from group:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error removing instructor from group',
      error: error.message 
    });
  }
};

// Add student to group (admin or instructor)
const addStudent = async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = req.params.groupId;
    const studentId = req.params.studentId;
    
    const group = await Group.findById(groupId);
    
    if (!group) {
      return res.status(404).json({ 
        success: false,
        message: 'Group not found' 
      });
    }
    
    // Check if user is admin, instructor, or event organizer
    const isAdmin = group.admin && group.admin.toString() === userId.toString();
    const isInstructor = group.instructors.some(id => id.toString() === userId.toString());
    const isEventOrganizer = group.events.some(id => id.toString() === userId.toString());
    
    if (!isAdmin && !isInstructor && !isEventOrganizer) {
      return res.status(403).json({ 
        success: false,
        message: 'Only the group admin, instructors, or event organizers can add students' 
      });
    }
    
    // Verify student exists
    const studentDoc = await User.findById(studentId);
    if (!studentDoc) {
      return res.status(404).json({ 
        success: false,
        message: 'Student user not found' 
      });
    }

    if (group.students.includes(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Student is already added to this group'
      });
    }
    
    // Add student to group
    await Group.findByIdAndUpdate(
      groupId,
      { $addToSet: { students: studentId } }
    );

    // Create notification for the added student
    try {
      await createGroupNotification(group, 'group_member_added', [studentId]);
    } catch (notificationError) {
      console.error('Error creating group member added notification:', notificationError);
      // Don't fail the operation if notifications fail
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error adding student to group:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error adding student to group',
      error: error.message 
    });
  }
};

// Remove student from group (admin only)
const removeStudent = async (req, res) => {
  try {
    const adminId = req.user.id;
    const groupId = req.params.groupId;
    const studentId = req.params.studentId;
    
    const group = await Group.findById(groupId);
    
    if (!group) {
      return res.status(404).json({ 
        success: false,
        message: 'Group not found' 
      });
    }

    // Check if user is admin, instructor, or event organizer
    const isAdmin = group.admin && group.admin.toString() === adminId.toString();
    const isInstructor = group.instructors.some(id => id.toString() === adminId.toString());
    const isEventOrganizer = group.events.some(id => id.toString() === adminId.toString());
    
    if (!isAdmin && !isInstructor && !isEventOrganizer) {
      return res.status(403).json({ 
        success: false,
        message: 'Only the group admin, instructors, or event organizers can remove students' 
      });
    }
    
    // Remove student from group
    await Group.findByIdAndUpdate(
      groupId,
      { $pull: { students: studentId } }
    );

    // Create notification for the removed student
    try {
      await createGroupNotification(group, 'group_member_removed', [studentId]);
    } catch (notificationError) {
      console.error('Error creating group member removed notification:', notificationError);
      // Don't fail the operation if notifications fail
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error removing student from group:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error removing student from group',
      error: error.message 
    });
  }
};

// Student leaves group
const leaveGroup = async (req, res) => {
  try {
    const studentId = req.user.id;
    const groupId = req.params.groupId;
    
    const group = await Group.findById(groupId);
    
    if (!group) {
      return res.status(404).json({ 
        success: false,
        message: 'Group not found' 
      });
    }
    
    // Verify student is in the group
    if (!group.students.some(id => id.toString() === studentId.toString())) {
      return res.status(400).json({ 
        success: false,
        message: 'Student is not a member of this group' 
      });
    }
    
    // Remove student from group
    await Group.findByIdAndUpdate(
      groupId,
      { $pull: { students: studentId } }
    );
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error leaving group:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error leaving group',
      error: error.message 
    });
  }
};

// Get group members with details
const getGroupMembers = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    
    const group = await Group.findById(groupId)
      .populate('admin', 'name email avatar role')
      .populate('instructors', 'name email avatar role')
      .populate('students', 'name email avatar role')
      .populate('events', 'name email avatar role');
    
    if (!group) {
      return res.status(404).json({ 
        success: false,
        message: 'Group not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        admin: group.admin,
        instructors: group.instructors,
        students: group.students,
        events: group.events
      }
    });
  } catch (error) {
    console.error('Error getting group members:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error getting group members',
      error: error.message 
    });
  }
};

const getGroupWithMessages = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.user.id;
    
    // Extract pagination parameters for messages
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Get the group with populated fields
    const group = await Group.findById(groupId)
      .populate('admin', 'name email avatar')
      .populate('instructors', 'name email avatar')
      .populate('students', 'name email avatar')
      .populate('events', 'name email avatar');
    
    if (!group) {
      return res.status(404).json({ 
        success: false,
        message: 'Group not found' 
      });
    }
    
    // Check if user is a member of the group
    const isAdmin = group.admin && group.admin._id.toString() === userId.toString();
    const isInstructor = group.instructors.some(instructor => instructor._id.toString() === userId.toString());
    const isStudent = group.students.some(student => student._id.toString() === userId.toString());
    const isEventOrganizer = group.events.some(event => event._id.toString() === userId.toString());
    
    if (!isAdmin && !isInstructor && !isStudent && !isEventOrganizer) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this group'
      });
    }
    
    // Process the group to remove the current user from students list
    const processedGroup = group.toObject();
    if (processedGroup.students && Array.isArray(processedGroup.students)) {
      processedGroup.students = processedGroup.students.filter(student => 
        student._id.toString() !== userId.toString()
      );
    }
    
    // Calculate member counts
    const memberCounts = {
      total: (group.admin ? 1 : 0) + (group.instructors?.length || 0) + (group.students?.length || 0) + (group.events?.length || 0),
      instructors: group.instructors?.length || 0,
      students: group.students?.length || 0,
      events: group.events?.length || 0
    };
    
    // Add member counts to the processed group
    processedGroup.memberCounts = memberCounts;
    
    // Get total message count for pagination
    const totalMessages = await Message.countDocuments({ groupId });
    
    // Get messages for the group
    const messages = await Message.find({ groupId })
      .populate('senderId', 'name email avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Process messages to add read status
    const messagesWithReadStatus = messages.map(message => {
      const messageObj = message.toObject();
      const isReadByCurrentUser = messageObj.readBy?.some(read => 
        read.userId.toString() === userId.toString()
      ) || false;
      const readCount = messageObj.readBy?.length || 0;
      
      return {
        ...messageObj,
        isReadByCurrentUser,
        readCount
      };
    }).reverse(); // Return in chronological order
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalMessages / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    res.status(200).json({
      success: true,
      data: {
        group: processedGroup,
        messages: {
          items: messagesWithReadStatus,
          pagination: {
            currentPage: page,
            totalPages,
            totalMessages,
            limit,
            hasNextPage,
            hasPrevPage
          }
        }
      }
    });
  } catch (error) {
    console.error('Error getting group with messages:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting group with messages',
      error: error.message
    });
  }
};

// Add event organizer to group (admin only)
const addEvent = async (req, res) => {
  try {
    const adminId = req.user.id;
    const groupId = req.params.groupId;
    const eventId = req.body.eventId;
    
    const group = await Group.findById(groupId);
    
    if (!group) {
      return res.status(404).json({ 
        success: false,
        message: 'Group not found' 
      });
    }

    if (group.admin && group.admin.toString() !== adminId.toString()) {
      return res.status(403).json({ 
        success: false,
        message: 'Only the group admin can add event organizers' 
      });
    }
    
    // Verify event organizer exists
    const eventDoc = await User.findById(eventId);
    if (!eventDoc) {
      return res.status(404).json({ 
        success: false,
        message: 'Event organizer not found' 
      });
    }
    
    // Add event organizer to group
    await Group.findByIdAndUpdate(
      groupId,
      { $addToSet: { events: eventId } }
    );
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error adding event organizer to group:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error adding event organizer to group',
      error: error.message 
    });
  }
};

// Remove event organizer from group (admin only)
const removeEvent = async (req, res) => {
  try {
    const adminId = req.user.id;
    const groupId = req.params.groupId;
    const eventId = req.params.eventId;
    
    const group = await Group.findById(groupId);
    
    if (!group) {
      return res.status(404).json({ 
        success: false,
        message: 'Group not found' 
      });
    }
    
    if (group.admin && group.admin.toString() !== adminId.toString()) {
      return res.status(403).json({ 
        success: false,
        message: 'Only the group admin can remove event organizers' 
      });
    }
    
    // Remove event organizer from group
    await Group.findByIdAndUpdate(
      groupId,
      { $pull: { events: eventId } }
    );
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error removing event organizer from group:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error removing event organizer from group',
      error: error.message 
    });
  }
};

module.exports = {
  createGroup,
  getAllGroups,
  getGroupById,
  getGroupsForUser,
  getGroupMembers,
  getGroupWithMessages,
  addInstructor,
  removeInstructor,
  addStudent,
  removeStudent,
  leaveGroup,
  addEvent,
  removeEvent
};

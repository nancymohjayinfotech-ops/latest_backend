const { sendNotification } = require('../services/notificationService');
// ✅ UNCOMMENTED: Now that you have the model, we can import and use it.
const Meeting = require('../models/Meeting'); 

/**
* Schedules a new meeting and notifies participants.
* @route POST /api/meetings/schedule
* @access Private (e.g., Instructor or Admin)
*/
exports.scheduleMeeting = async (req, res) => {
 try {

     const { studentId, instructorId, title, time, meetingLink } = req.body;

 const senderId = req.user.id; // The user creating the meeting


 // Validate input

 if (!studentId || !instructorId || !title || !time || !meetingLink) {

     return res.status(400).json({ success: false, message: 'Missing required meeting details.' });

 }


 // ✅ UPDATED: This now saves the meeting to your database.

 const newMeeting = await Meeting.create({ studentId, instructorId, title, time, meetingLink, createdBy: senderId });


 // --- Notification Logic ---

 const recipients = [studentId, instructorId];



 await sendNotification({

     recipients,

 sender: senderId,

 type: 'MEETING_SCHEDULED',

 title: 'Meeting Scheduled',

 message: `A new meeting '${title}' is scheduled for ${new Date(time).toLocaleString()}.`,

 data: {
            // ✅ UPDATED: Now includes the actual ID from the saved meeting object.

             meetingId: newMeeting._id.toString(), 

 link: meetingLink

 }

 });


 res.status(201).json({ 
        success: true, 
        message: 'Meeting scheduled and notifications sent.',
        data: newMeeting 
    });

 } catch (error) {

     console.error("Error scheduling meeting:", error);

 res.status(500).json({ success: false, message: 'Server error while scheduling meeting.' });
 }
};
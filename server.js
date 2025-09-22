const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const connectDB = require('./config/mongodb');
const morgan = require('morgan');
dotenv.config({ path: './.env' });
connectDB();

const app = express();
const server = http.createServer(app);
const io = socketIo(server,{
  cors: {
    origin: "*", // Your Angular app URL
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.set('io', io);
app.use(cors());
app.use(express.json());  
app.use(express.static('public'));
// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use("/hls", express.static(path.join(__dirname, "hls")));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(morgan('dev'));

const mongoAuthRoutes = require('./routes/mongoAuth');
const courseRoutes = require('./routes/courses');
// const userRoutes = require('./routes/users');
const categoryRoutes = require('./routes/categories');
const subcategoryRoutes = require('./routes/subcategories');
const contentRoutes = require('./routes/content');
const offerRoutes = require('./routes/offers');
const groupRoutes = require('./routes/groups');
const messageRoutes = require('./routes/messages');
const dashboardRoutes = require('./routes/dashboard');
const paymentRoutes = require('./routes/payments');
const cartRoutes = require('./routes/cart');
const instructorRoutes = require('./routes/instructor');
const quizRoutes = require('./routes/quizzes');
const assessmentRoutes = require('./routes/assessments');
const uploadRoutes = require('./routes/uploads');
const eventRoutes = require('./routes/events');
const adminEventRoutes = require('./routes/adminEvents');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const deviceTokenRoutes = require('./routes/deviceTokens');
const chatMediaRoutes = require('./routes/chatMedia');
// const {seedData} = require('./seedData');
const studentRoutes = require('./routes/student');
// const userRoutes = require('./routes/users');
const userRoutes = require('./routes/users');

app.use('/api/users', userRoutes);
app.use('/api/auth', mongoAuthRoutes);
app.use('/api/courses', courseRoutes);
// app.use('/api/user', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/subcategories', subcategoryRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/adevents', adminEventRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/device-tokens', deviceTokenRoutes);
app.use('/api/chat-media', chatMediaRoutes);
app.use('/api/student', studentRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// app.get('/seed',(req,res)=>{
//   seedData();
//   return res.status(200).json({"status":'done'});
// })
app.get('/test/chat', (req, res) => {
  res.render('chat-test');
});

const initializeSocket = require('./socket/socketHandler');

initializeSocket(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Using MongoDB as database');
});

module.exports = app;

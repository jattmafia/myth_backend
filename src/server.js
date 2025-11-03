const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user_route');
const novelRoutes = require('./routes/novel_route');
const chapterRoutes = require('./routes/chapter_route');
const reviewRoutes = require('./routes/review_route');
const chapterAccessRoutes = require('./routes/chapterAccess_route');
const writerEarningRoutes = require('./routes/writerEarning_route');
const categoryRoutes = require('./routes/category_route');
const { use } = require('passport');

const app = express();
const PORT = process.env.PORT || 3000;

// Request logging middleware
// app.use((req, res, next) => {
//   const timestamp = new Date().toISOString();
//   const method = req.method;
//   const url = req.originalUrl;
//   const ip = req.ip || req.connection.remoteAddress;
//   const userAgent = req.get('User-Agent') || 'Unknown';

//   console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);
//   console.log(`   User-Agent: ${userAgent}`);

//   // Log request body for POST/PUT requests (excluding sensitive data)
//   if (['POST', 'PUT', 'PATCH'].includes(method) && req.body) {
//     const bodyLog = { ...req.body };
//     // Hide sensitive fields
//     if (bodyLog.password) bodyLog.password = '[HIDDEN]';
//     if (bodyLog.email) bodyLog.email = '[HIDDEN]';
//     console.log(`   Body:`, JSON.stringify(bodyLog, null, 2));
//   }

//   // Log response time
//   const startTime = Date.now();
//   res.on('finish', () => {
//     const duration = Date.now() - startTime;
//     const statusCode = res.statusCode;
//     const statusEmoji = statusCode >= 200 && statusCode < 300 ? '✅' : 
//                        statusCode >= 400 && statusCode < 500 ? '⚠️' : '❌';
//     console.log(`   ${statusEmoji} ${statusCode} - ${duration}ms\n`);
//   });

//   next();
// });

// Middleware
app.use(express.json()); // Parse JSON bodies

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/novel', novelRoutes);
app.use('/api/chapter', chapterRoutes);

// Add review routes
app.use('/api/review', reviewRoutes);

// Add chapter access routes
app.use('/api/chapter-access', chapterAccessRoutes);

// Add writer earning routes
app.use('/api/writer-earning', writerEarningRoutes);

// Add category routes
app.use('/api/categories', categoryRoutes);

// /route for testing
app.get('/api', (req, res) => {
  res.send('Welcome to the Authentication API!');
});


// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Start server and connect to MongoDB
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();

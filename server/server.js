const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// CORS configuration
const corsOptions = {
  origin: '*', // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
console.log('🌐 CORS configured with options:', corsOptions);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  // Log request
  console.log(`📥 REQUEST: ${req.method} ${req.originalUrl}`, 
    req.body && Object.keys(req.body).length ? `\nBody: ${JSON.stringify(req.body, null, 2)}` : '');
  
  // Override res.send to intercept the response
  res.send = function (body) {
    const responseTime = Date.now() - start;
    
    // Log response
    console.log(`📤 RESPONSE: ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - Time: ${responseTime}ms`);
    
    originalSend.call(this, body);
  };
  
  next();
});

// Connect to MongoDB with modified connection options
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/feedrank';
console.log('Connecting to MongoDB with URI:', mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//****:****@'));

// Create a custom connection to MongoDB that avoids any replica set config
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  directConnection: true, // Force direct connection
  replicaSet: undefined   // Explicitly disable replica set
};

// Make sure we're using the feedrank database
let feedrankURI = mongoURI;
if (!mongoURI.includes('/feedrank')) {
  feedrankURI = mongoURI.replace(/\/[^?]+(\?.+)?$/, '/feedrank$1');
  console.log('Ensuring connection to feedrank database');
}

mongoose.connect(feedrankURI, mongooseOptions)
  .then(() => {
    console.log('MongoDB connected successfully');
    
    // List available databases to confirm connection
    mongoose.connection.db.admin().listDatabases()
      .then(result => {
        console.log('Available databases:', result.databases.map(db => db.name).join(', '));
      })
      .catch(err => {
        console.error('Error listing databases:', err.message);
      });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    console.error('Error details:', err.message);
    if (err.name === 'MongooseServerSelectionError') {
      console.error('Server selection error details:', err.reason);
    }
  });

// API Routes
app.use('/api/users', require('./controllers/users'));
app.use('/api/vk-sources', require('./controllers/vkSources'));
app.use('/api/telegram-channels', require('./controllers/telegramChannels'));
app.use('/api/mappings', require('./controllers/mappings'));
app.use('/api/posts', require('./controllers/posts'));
app.use('/api/settings', require('./controllers/settings'));
app.use('/api/vk-source-groups', require('./controllers/vkSourceGroups'));
app.use('/api/analytics', require('./controllers/analytics'));

// Initialize services
const vkService = require('./services/vk');
const telegramService = require('./services/telegram');
const schedulerService = require('./services/scheduler');

// Start services
telegramService.init();
schedulerService.init();

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error', error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 
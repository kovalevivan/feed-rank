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

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  // Store original URL and request body
  const requestData = {
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    query: req.query,
    params: req.params,
    timestamp: new Date().toISOString()
  };
  
  console.log(`📥 REQUEST: ${req.method} ${req.originalUrl}`, 
    req.body && Object.keys(req.body).length ? `\nBody: ${JSON.stringify(req.body, null, 2)}` : '');
  
  // Override res.send to intercept the response
  res.send = function (body) {
    const responseTime = Date.now() - start;
    const responseData = {
      statusCode: res.statusCode,
      body: body ? JSON.parse(body) : {},
      responseTime: `${responseTime}ms`
    };
    
    console.log(`📤 RESPONSE: ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - Time: ${responseTime}ms`);
    
    // Store request and response in log file
    try {
      const logPath = path.resolve(__dirname, '../.tmp-logs/requests.json');
      let logs = {};
      
      if (fs.existsSync(logPath)) {
        const fileContent = fs.readFileSync(logPath, 'utf8');
        if (fileContent) {
          logs = JSON.parse(fileContent);
        }
      }
      
      const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      logs[requestId] = {
        request: requestData,
        response: responseData
      };
      
      fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    } catch (err) {
      console.error('Error writing to request log:', err);
    }
    
    originalSend.call(this, body);
  };
  
  next();
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/feedrank')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// API Routes
app.use('/api/users', require('./controllers/users'));
app.use('/api/vk-sources', require('./controllers/vkSources'));
app.use('/api/telegram-channels', require('./controllers/telegramChannels'));
app.use('/api/mappings', require('./controllers/mappings'));
app.use('/api/posts', require('./controllers/posts'));
app.use('/api/settings', require('./controllers/settings'));

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
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// Load environment variables from the repository root first, then local server overrides.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
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

mongoose.connect(mongoURI, mongooseOptions)
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

    // Ensure critical indexes exist with proper options (sparse, unique) to avoid duplicate key issues
    (async () => {
      try {
        const Post = require('./models/Post');
        const indexes = await Post.collection.indexes();
        const byName = Object.fromEntries(indexes.map(i => [i.name, i]));

        // Helper to recreate an index with desired options if mismatch
        const ensureIndex = async (keySpec, options) => {
          const name = options.name;
          const existing = byName[name];
          const needsRecreate = !existing || existing.unique !== !!options.unique || existing.sparse !== !!options.sparse;
          if (needsRecreate) {
            if (existing) {
              console.warn(`Recreating index ${name} with correct options (unique=${options.unique}, sparse=${options.sparse})`);
              await Post.collection.dropIndex(name).catch(() => {});
            } else {
              console.log(`Creating missing index ${name}`);
            }
            await Post.collection.createIndex(keySpec, options);
          }
        };

        await ensureIndex({ vkSource: 1, postId: 1 }, { unique: true, sparse: true, name: 'vkSource_1_postId_1' });
        await ensureIndex({ telegramSource: 1, originalPostId: 1 }, { unique: true, sparse: true, name: 'telegramSource_1_originalPostId_1' });
        console.log('✅ Post indexes verified');
      } catch (idxErr) {
        console.warn('Could not verify/create indexes:', idxErr.message);
      }
    })();
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
app.use('/api/telegram-sources', require('./controllers/telegramSources'));
app.use('/api/mappings', require('./controllers/mappings'));
app.use('/api/posts', require('./controllers/posts'));
app.use('/api/settings', require('./controllers/settings'));
app.use('/api/vk-source-groups', require('./controllers/vkSourceGroups'));
app.use('/api/source-groups', require('./controllers/sourceGroups'));
app.use('/api/telegram-analytics', require('./controllers/telegramAnalytics'));
app.get('/api/health', (req, res) => {
  const telegramAnalyticsService = require('./services/telegramAnalytics');
  res.json({ status: 'ok', telegramAnalytics: telegramAnalyticsService.getHealth() });
});

// Initialize services
const vkService = require('./services/vk');
const telegramService = require('./services/telegram');
const telegramSourcesService = require('./services/telegram/sources');
const schedulerService = require('./services/scheduler');
const telegramAnalyticsService = require('./services/telegramAnalytics');

// Start services
const initializeServices = async () => {
  try {
    await telegramAnalyticsService.init();
    telegramService.init();
    await telegramSourcesService.init();
    schedulerService.init();
    console.log('✅ All services initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing services:', error);
  }
};

initializeServices();

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../client/build');
  const clientIndexPath = path.resolve(clientBuildPath, 'index.html');

  if (fs.existsSync(clientIndexPath)) {
    app.use(express.static(clientBuildPath));

    app.get('*', (req, res) => {
      res.sendFile(clientIndexPath);
    });
  } else {
    console.warn('Client build not found. Serving API only.');
    app.get('/', (req, res) => {
      res.json({ status: 'ok', mode: 'api-only' });
    });
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error', error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 

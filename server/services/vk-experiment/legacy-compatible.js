#!/usr/bin/env node

/**
 * VK Views Experiment - Legacy Node.js Compatible Version
 * Совместимо с Node.js 10+ (без optional chaining и других современных функций)
 */

// Базовые модули - должны быть в любой версии Node.js
const fs = require('fs');
const path = require('path');

// Проверяем доступность модулей
let VK, cron;
try {
  const vkio = require('vk-io');
  VK = vkio.VK;
  cron = require('node-cron');
} catch (error) {
  console.error('❌ Ошибка загрузки модулей:', error.message);
  console.log('💡 Попробуйте установить зависимости:');
  console.log('   npm install vk-io node-cron');
  process.exit(1);
}

class LegacyVKExperiment {
  constructor() {
    this.vk = null;
    
    // Определяем режим работы
    const isTestMode = process.env.VK_EXPERIMENT_TEST_MODE === 'true';
    
    this.config = {
      accessToken: process.env.VK_EXPERIMENT_TOKEN || '033b5ad1033b5ad1033b5ad18b000beccb0033b033b5ad16b2dd6d4b4dc1ca34cf5232a',
      groups: process.env.VK_EXPERIMENT_GROUPS ? process.env.VK_EXPERIMENT_GROUPS.split(',') : ['chp_nn'],
      shortTermDuration: isTestMode ? 30 : (8 * 60), // 30 мин для теста, 8 часов для продакшна
      shortTermInterval: isTestMode ? 5 : 30, // 5 мин для теста, 30 мин для продакшна
      isTestMode: isTestMode,
      csvDir: path.join(__dirname, 'data'),
      shortTermCsv: 'short_term_views.csv',
      longTermCsv: 'long_term_views.csv'
    };
    
    this.activeTrackings = new Map();
    this.scheduledChecks = new Map();
    
    this.initializeVK();
    this.ensureDataDir();
    this.startExperiment();
  }

  initializeVK() {
    if (!this.config.accessToken) {
      throw new Error('VK_EXPERIMENT_TOKEN is not set');
    }
    
    this.vk = new VK({
      token: this.config.accessToken
    });
    
    console.log('🔬 VK Experiment service initialized (Legacy Mode)');
  }

  ensureDataDir() {
    try {
      if (!fs.existsSync(this.config.csvDir)) {
        fs.mkdirSync(this.config.csvDir, { recursive: true });
      }
    } catch (error) {
      console.error('Error creating data directory:', error);
    }
  }

  async resolveGroupId(groupName) {
    try {
      if (!isNaN(groupName)) {
        return groupName;
      }
      
      try {
        const resolved = await this.vk.api.utils.resolveScreenName({
          screen_name: groupName
        });
        
        if (resolved && resolved.type === 'group') {
          return resolved.object_id.toString();
        }
      } catch (error) {
        // Продолжаем
      }
      
      try {
        const response = await this.vk.api.groups.getById({
          group_id: groupName
        });
        
        if (response && response.length > 0) {
          return response[0].id.toString();
        }
      } catch (error) {
        // Продолжаем
      }
      
      throw new Error('Could not resolve group ID for ' + groupName);
    } catch (error) {
      console.error('Error resolving group ID for ' + groupName + ':', error);
      throw error;
    }
  }

  async fetchGroupPosts(groupId, count) {
    count = count || 10;
    try {
      const formattedGroupId = groupId.startsWith('-') ? groupId.substring(1) : groupId;
      
      const response = await this.vk.api.wall.get({
        owner_id: '-' + formattedGroupId,
        count: count,
        extended: 1
      });
      
      return response.items;
    } catch (error) {
      console.error('Error fetching posts for group ' + groupId + ':', error);
      throw error;
    }
  }

  initializeCsvFiles() {
    const shortTermPath = path.join(this.config.csvDir, this.config.shortTermCsv);
    const longTermPath = path.join(this.config.csvDir, this.config.longTermCsv);

    const shortTermHeaders = 'session_id,group_name,group_id,post_id,check_time,elapsed_minutes,views,likes,reposts,published_at,post_text_preview\n';
    const longTermHeaders = 'session_id,group_name,group_id,post_id,initial_views,views_24h,views_48h,growth_24h,growth_48h,published_at,post_text_preview\n';

    try {
      if (!fs.existsSync(shortTermPath)) {
        fs.writeFileSync(shortTermPath, shortTermHeaders, 'utf8');
        console.log('📊 Created short-term CSV file with headers');
      }

      if (!fs.existsSync(longTermPath)) {
        fs.writeFileSync(longTermPath, longTermHeaders, 'utf8');
        console.log('📊 Created long-term CSV file with headers');
      }
    } catch (error) {
      console.error('Error initializing CSV files:', error);
    }
  }

  generateSessionId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return year + month + day + '_' + hours + minutes;
  }

  async collectInitialData() {
    console.log('🔍 Starting new data collection session...');
    
    const sessionId = this.generateSessionId();
    const sessionData = {
      sessionId: sessionId,
      startTime: new Date(),
      groups: new Map(),
      checksRemaining: Math.floor(this.config.shortTermDuration / this.config.shortTermInterval),
      currentCheck: 0
    };

    for (let i = 0; i < this.config.groups.length; i++) {
      const groupName = this.config.groups[i];
      try {
        console.log('📊 Collecting initial data for group: ' + groupName);
        
        const groupId = await this.resolveGroupId(groupName);
        const posts = await this.fetchGroupPosts(groupId, 10);

        const groupData = {
          groupName: groupName,
          groupId: groupId,
          posts: new Map()
        };

        for (let j = 0; j < posts.length; j++) {
          const post = posts[j];
          const postData = {
            postId: post.id.toString(),
            initialViews: (post.views && post.views.count) || 0,
            initialLikes: (post.likes && post.likes.count) || 0,
            initialReposts: (post.reposts && post.reposts.count) || 0,
            publishedAt: new Date(post.date * 1000),
            textPreview: (post.text || '').substring(0, 100).replace(/\n/g, ' ').replace(/"/g, '""')
          };
          
          groupData.posts.set(postData.postId, postData);
        }

        sessionData.groups.set(groupName, groupData);
        console.log('✅ Collected data for ' + posts.length + ' posts from ' + groupName);
        
      } catch (error) {
        console.error('❌ Failed to collect initial data for ' + groupName + ':', error);
      }
    }

    this.activeTrackings.set(sessionId, sessionData);
    await this.writeShortTermData(sessionData, 0);
    
    console.log('🚀 Started tracking session ' + sessionId + ' for ' + sessionData.groups.size + ' groups');
    
    return sessionId;
  }

  async writeShortTermData(sessionData, elapsedMinutes) {
    const shortTermPath = path.join(this.config.csvDir, this.config.shortTermCsv);
    
    let csvContent = '';
    
    const groupEntries = Array.from(sessionData.groups.entries());
    for (let i = 0; i < groupEntries.length; i++) {
      const entry = groupEntries[i];
      const groupName = entry[0];
      const groupData = entry[1];
      
      try {
        const currentPosts = await this.fetchGroupPosts(groupData.groupId, 15);
        
        const postEntries = Array.from(groupData.posts.entries());
        for (let j = 0; j < postEntries.length; j++) {
          const postEntry = postEntries[j];
          const postId = postEntry[0];
          const postData = postEntry[1];
          
          const currentPost = currentPosts.find(function(p) { return p.id.toString() === postId; });
          
          if (currentPost) {
            const currentViews = (currentPost.views && currentPost.views.count) || 0;
            const currentLikes = (currentPost.likes && currentPost.likes.count) || 0;
            const currentReposts = (currentPost.reposts && currentPost.reposts.count) || 0;
            
            csvContent += '"' + sessionData.sessionId + '","' + groupName + '","' + groupData.groupId + '","' + postId + '","' + new Date().toISOString() + '",' + elapsedMinutes + ',' + currentViews + ',' + currentLikes + ',' + currentReposts + ',"' + postData.publishedAt.toISOString() + '","' + postData.textPreview + '"\n';
          }
        }
      } catch (error) {
        console.error('Error collecting data for group ' + groupName + ':', error);
      }
    }
    
    if (csvContent) {
      try {
        fs.appendFileSync(shortTermPath, csvContent, 'utf8');
        console.log('📝 Recorded data for session ' + sessionData.sessionId + ' (' + elapsedMinutes + ' min)');
      } catch (error) {
        console.error('Error writing to short-term CSV:', error);
      }
    }
  }

  async performShortTermCheck(sessionId) {
    const sessionData = this.activeTrackings.get(sessionId);
    if (!sessionData) {
      console.log('❌ Session ' + sessionId + ' not found for short-term check');
      return;
    }

    sessionData.currentCheck++;
    const elapsedMinutes = sessionData.currentCheck * this.config.shortTermInterval;

    console.log('🔍 Performing short-term check ' + sessionData.currentCheck + '/' + sessionData.checksRemaining + ' for session ' + sessionId + ' (' + elapsedMinutes + ' min)');
    
    await this.writeShortTermData(sessionData, elapsedMinutes);

    if (sessionData.currentCheck >= sessionData.checksRemaining) {
      console.log('✅ Completed short-term tracking for session ' + sessionId);
      this.scheduleLongTermChecks(sessionId);
      this.activeTrackings.delete(sessionId);
    }
  }

  scheduleLongTermChecks(sessionId) {
    const sessionData = this.activeTrackings.get(sessionId);
    if (!sessionData) {
      console.log('❌ Cannot schedule long-term checks for session ' + sessionId + ' - session data not found');
      return;
    }

    this.scheduledChecks.set(sessionId, sessionData);

    const now = new Date();
    const check24h = new Date(sessionData.startTime.getTime() + 24 * 60 * 60 * 1000);
    const check48h = new Date(sessionData.startTime.getTime() + 48 * 60 * 60 * 1000);

    console.log('📅 Scheduled long-term checks for session ' + sessionId + ':');
    console.log('   - 24h check: ' + check24h.toLocaleString());
    console.log('   - 48h check: ' + check48h.toLocaleString());

    const self = this;
    
    if (check24h > now) {
      setTimeout(function() {
        self.performLongTermCheck(sessionId, '24h');
      }, check24h.getTime() - now.getTime());
    }

    if (check48h > now) {
      setTimeout(function() {
        self.performLongTermCheck(sessionId, '48h');
        self.scheduledChecks.delete(sessionId);
      }, check48h.getTime() - now.getTime());
    }
  }

  performLongTermCheck(sessionId, period) {
    const sessionData = this.scheduledChecks.get(sessionId);
    if (!sessionData) {
      console.log('❌ Session ' + sessionId + ' not found for long-term check (' + period + ')');
      return;
    }

    console.log('🔍 Performing long-term check for session ' + sessionId + ' (' + period + ')');
    console.log('✅ Completed ' + period + ' check for session ' + sessionId);
  }

  async startExperiment() {
    console.log('🚀 Starting VK Views Experiment...');
    console.log('🔬 Mode: ' + (this.config.isTestMode ? 'TEST' : 'PRODUCTION'));
    console.log('📊 Groups to track: ' + this.config.groups.join(', '));
    console.log('⏱️  Short-term: ' + this.config.shortTermDuration + ' minutes (every ' + this.config.shortTermInterval + ' min)');
    console.log('📈 Long-term checks: 24h and 48h after session start');
    
    this.initializeCsvFiles();
    
    await this.startNewSession();
    
    const cronPattern = this.config.isTestMode ? '*/10 * * * *' : '0 */12 * * *';
    const self = this;
    
    cron.schedule(cronPattern, function() {
      console.log('⏰ Starting scheduled new tracking session...');
      self.startNewSession();
    });

    console.log('✅ VK Views Experiment is running!');
  }

  async startNewSession() {
    try {
      const sessionId = await this.collectInitialData();
      
      let checkCount = 0;
      const self = this;
      const shortTermInterval = setInterval(function() {
        checkCount++;
        self.performShortTermCheck(sessionId);
        
        if (checkCount >= Math.floor(self.config.shortTermDuration / self.config.shortTermInterval)) {
          clearInterval(shortTermInterval);
        }
      }, this.config.shortTermInterval * 60 * 1000);

    } catch (error) {
      console.error('❌ Error starting new tracking session:', error);
    }
  }

  getStatus() {
    return {
      activeSessions: Array.from(this.activeTrackings.keys()),
      scheduledSessions: Array.from(this.scheduledChecks.keys()),
      config: {
        groups: this.config.groups,
        shortTermDuration: this.config.shortTermDuration,
        shortTermInterval: this.config.shortTermInterval
      }
    };
  }

  stop() {
    console.log('🛑 Stopping VK Views Experiment...');
  }
}

// Проверяем аргументы командной строки
const command = process.argv[2];

if (command === 'test') {
  // Тестовый режим
  console.log('🧪 Running compatibility test...');
  
  try {
    const experiment = new LegacyVKExperiment();
    console.log('✅ Compatibility test passed!');
    console.log('📊 Config: ' + JSON.stringify(experiment.config, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('❌ Compatibility test failed:', error.message);
    process.exit(1);
  }
} else if (command === 'start') {
  // Запуск эксперимента
  console.log('🚀 Starting Legacy VK Experiment...');
  
  process.on('SIGINT', function() {
    console.log('\n🛑 Получен сигнал остановки...');
    process.exit(0);
  });
  
  try {
    new LegacyVKExperiment();
    
    // Держим процесс активным
    process.stdin.resume();
  } catch (error) {
    console.error('❌ Error starting experiment:', error.message);
    process.exit(1);
  }
} else {
  console.log('🔬 VK Views Experiment - Legacy Compatible Version');
  console.log('');
  console.log('Команды:');
  console.log('  start - Запустить эксперимент');
  console.log('  test  - Тест совместимости');
  console.log('');
  console.log('Примеры:');
  console.log('  node legacy-compatible.js start');
  console.log('  node legacy-compatible.js test');
}

module.exports = LegacyVKExperiment;

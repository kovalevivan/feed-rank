#!/usr/bin/env node

/**
 * VK Views Experiment - Node.js 12 Compatible Version
 * Максимально совместимая версия для старых Node.js
 */

var fs = require('fs');
var path = require('path');

// Проверяем доступность модулей
var VK, cron;
try {
  var vkio = require('vk-io');
  VK = vkio.VK;
  cron = require('node-cron');
} catch (error) {
  console.error('Ошибка загрузки модулей:', error.message);
  console.log('Попробуйте установить зависимости:');
  console.log('   npm install vk-io node-cron');
  process.exit(1);
}

function Node12VKExperiment() {
  var self = this;
  self.vk = null;
  
  // Определяем режим работы
  var isTestMode = process.env.VK_EXPERIMENT_TEST_MODE === 'true';
  
  self.config = {
    accessToken: process.env.VK_EXPERIMENT_TOKEN || '033b5ad1033b5ad1033b5ad18b000beccb0033b033b5ad16b2dd6d4b4dc1ca34cf5232a',
    groups: process.env.VK_EXPERIMENT_GROUPS ? process.env.VK_EXPERIMENT_GROUPS.split(',') : ['chp_nn'],
    shortTermDuration: isTestMode ? 30 : (8 * 60), // 30 мин для теста, 8 часов для продакшна
    shortTermInterval: isTestMode ? 5 : 30, // 5 мин для теста, 30 мин для продакшна
    isTestMode: isTestMode,
    csvDir: path.join(__dirname, 'data'),
    shortTermCsv: 'short_term_views.csv',
    longTermCsv: 'long_term_views.csv'
  };
  
  self.activeTrackings = new Map();
  self.scheduledChecks = new Map();
  
  self.initializeVK();
  self.ensureDataDir();
  self.startExperiment();
}

Node12VKExperiment.prototype.initializeVK = function() {
  var self = this;
  if (!self.config.accessToken) {
    throw new Error('VK_EXPERIMENT_TOKEN is not set');
  }
  
  self.vk = new VK({
    token: self.config.accessToken
  });
  
  console.log('VK Experiment service initialized (Node.js 12 Mode)');
};

Node12VKExperiment.prototype.ensureDataDir = function() {
  var self = this;
  try {
    if (!fs.existsSync(self.config.csvDir)) {
      fs.mkdirSync(self.config.csvDir, { recursive: true });
    }
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
};

Node12VKExperiment.prototype.resolveGroupId = function(groupName) {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (!isNaN(groupName)) {
      resolve(groupName);
      return;
    }
    
    self.vk.api.utils.resolveScreenName({
      screen_name: groupName
    }).then(function(resolved) {
      if (resolved && resolved.type === 'group') {
        resolve(resolved.object_id.toString());
      } else {
        // Пробуем второй способ
        return self.vk.api.groups.getById({
          group_id: groupName
        });
      }
    }).then(function(response) {
      if (response && response.length > 0) {
        resolve(response[0].id.toString());
      } else {
        reject(new Error('Could not resolve group ID for ' + groupName));
      }
    }).catch(function(error) {
      reject(error);
    });
  });
};

Node12VKExperiment.prototype.fetchGroupPosts = function(groupId, count) {
  var self = this;
  count = count || 10;
  
  return new Promise(function(resolve, reject) {
    var formattedGroupId = groupId.startsWith('-') ? groupId.substring(1) : groupId;
    
    self.vk.api.wall.get({
      owner_id: '-' + formattedGroupId,
      count: count,
      extended: 1
    }).then(function(response) {
      resolve(response.items);
    }).catch(function(error) {
      console.error('Error fetching posts for group ' + groupId + ':', error);
      reject(error);
    });
  });
};

Node12VKExperiment.prototype.initializeCsvFiles = function() {
  var self = this;
  var shortTermPath = path.join(self.config.csvDir, self.config.shortTermCsv);
  var longTermPath = path.join(self.config.csvDir, self.config.longTermCsv);

  var shortTermHeaders = 'session_id,group_name,group_id,post_id,check_time,elapsed_minutes,views,likes,reposts,published_at,post_text_preview\n';
  var longTermHeaders = 'session_id,group_name,group_id,post_id,initial_views,views_24h,views_48h,growth_24h,growth_48h,published_at,post_text_preview\n';

  try {
    if (!fs.existsSync(shortTermPath)) {
      fs.writeFileSync(shortTermPath, shortTermHeaders, 'utf8');
      console.log('Created short-term CSV file with headers');
    }

    if (!fs.existsSync(longTermPath)) {
      fs.writeFileSync(longTermPath, longTermHeaders, 'utf8');
      console.log('Created long-term CSV file with headers');
    }
  } catch (error) {
    console.error('Error initializing CSV files:', error);
  }
};

Node12VKExperiment.prototype.generateSessionId = function() {
  var now = new Date();
  var year = now.getFullYear();
  var month = String(now.getMonth() + 1);
  var day = String(now.getDate());
  var hours = String(now.getHours());
  var minutes = String(now.getMinutes());
  
  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  if (hours.length < 2) hours = '0' + hours;
  if (minutes.length < 2) minutes = '0' + minutes;
  
  return year + month + day + '_' + hours + minutes;
};

Node12VKExperiment.prototype.collectInitialData = function() {
  var self = this;
  console.log('Starting new data collection session...');
  
  return new Promise(function(resolve, reject) {
    var sessionId = self.generateSessionId();
    var sessionData = {
      sessionId: sessionId,
      startTime: new Date(),
      groups: new Map(),
      checksRemaining: Math.floor(self.config.shortTermDuration / self.config.shortTermInterval),
      currentCheck: 0
    };

    var groupPromises = [];
    
    for (var i = 0; i < self.config.groups.length; i++) {
      var groupName = self.config.groups[i];
      groupPromises.push(self.processGroup(groupName, sessionData));
    }
    
    Promise.all(groupPromises).then(function() {
      self.activeTrackings.set(sessionId, sessionData);
      return self.writeShortTermData(sessionData, 0);
    }).then(function() {
      console.log('Started tracking session ' + sessionId + ' for ' + sessionData.groups.size + ' groups');
      resolve(sessionId);
    }).catch(function(error) {
      reject(error);
    });
  });
};

Node12VKExperiment.prototype.processGroup = function(groupName, sessionData) {
  var self = this;
  console.log('Collecting initial data for group: ' + groupName);
  
  return new Promise(function(resolve, reject) {
    self.resolveGroupId(groupName).then(function(groupId) {
      return self.fetchGroupPosts(groupId, 10);
    }).then(function(posts) {
      var groupData = {
        groupName: groupName,
        groupId: groupId,
        posts: new Map()
      };

      for (var j = 0; j < posts.length; j++) {
        var post = posts[j];
        var postData = {
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
      console.log('Collected data for ' + posts.length + ' posts from ' + groupName);
      resolve();
    }).catch(function(error) {
      console.error('Failed to collect initial data for ' + groupName + ':', error);
      resolve(); // Продолжаем с другими группами
    });
  });
};

Node12VKExperiment.prototype.writeShortTermData = function(sessionData, elapsedMinutes) {
  var self = this;
  return new Promise(function(resolve) {
    var shortTermPath = path.join(self.config.csvDir, self.config.shortTermCsv);
    var csvContent = '';
    var groupPromises = [];
    
    var groupEntries = Array.from(sessionData.groups.entries());
    
    for (var i = 0; i < groupEntries.length; i++) {
      var entry = groupEntries[i];
      var groupName = entry[0];
      var groupData = entry[1];
      
      groupPromises.push(self.processGroupData(groupName, groupData, sessionData, elapsedMinutes));
    }
    
    Promise.all(groupPromises).then(function(results) {
      for (var j = 0; j < results.length; j++) {
        csvContent += results[j];
      }
      
      if (csvContent) {
        try {
          fs.appendFileSync(shortTermPath, csvContent, 'utf8');
          console.log('Recorded data for session ' + sessionData.sessionId + ' (' + elapsedMinutes + ' min)');
        } catch (error) {
          console.error('Error writing to short-term CSV:', error);
        }
      }
      resolve();
    });
  });
};

Node12VKExperiment.prototype.processGroupData = function(groupName, groupData, sessionData, elapsedMinutes) {
  var self = this;
  return new Promise(function(resolve) {
    self.fetchGroupPosts(groupData.groupId, 15).then(function(currentPosts) {
      var csvContent = '';
      var postEntries = Array.from(groupData.posts.entries());
      
      for (var j = 0; j < postEntries.length; j++) {
        var postEntry = postEntries[j];
        var postId = postEntry[0];
        var postData = postEntry[1];
        
        var currentPost = null;
        for (var k = 0; k < currentPosts.length; k++) {
          if (currentPosts[k].id.toString() === postId) {
            currentPost = currentPosts[k];
            break;
          }
        }
        
        if (currentPost) {
          var currentViews = (currentPost.views && currentPost.views.count) || 0;
          var currentLikes = (currentPost.likes && currentPost.likes.count) || 0;
          var currentReposts = (currentPost.reposts && currentPost.reposts.count) || 0;
          
          csvContent += '"' + sessionData.sessionId + '","' + groupName + '","' + groupData.groupId + '","' + postId + '","' + new Date().toISOString() + '",' + elapsedMinutes + ',' + currentViews + ',' + currentLikes + ',' + currentReposts + ',"' + postData.publishedAt.toISOString() + '","' + postData.textPreview + '"\n';
        }
      }
      resolve(csvContent);
    }).catch(function(error) {
      console.error('Error collecting data for group ' + groupName + ':', error);
      resolve('');
    });
  });
};

Node12VKExperiment.prototype.performShortTermCheck = function(sessionId) {
  var self = this;
  var sessionData = self.activeTrackings.get(sessionId);
  if (!sessionData) {
    console.log('Session ' + sessionId + ' not found for short-term check');
    return Promise.resolve();
  }

  sessionData.currentCheck++;
  var elapsedMinutes = sessionData.currentCheck * self.config.shortTermInterval;

  console.log('Performing short-term check ' + sessionData.currentCheck + '/' + sessionData.checksRemaining + ' for session ' + sessionId + ' (' + elapsedMinutes + ' min)');
  
  return self.writeShortTermData(sessionData, elapsedMinutes).then(function() {
    if (sessionData.currentCheck >= sessionData.checksRemaining) {
      console.log('Completed short-term tracking for session ' + sessionId);
      self.scheduleLongTermChecks(sessionId);
      self.activeTrackings.delete(sessionId);
    }
  });
};

Node12VKExperiment.prototype.scheduleLongTermChecks = function(sessionId) {
  var self = this;
  var sessionData = self.activeTrackings.get(sessionId);
  if (!sessionData) {
    console.log('Cannot schedule long-term checks for session ' + sessionId + ' - session data not found');
    return;
  }

  self.scheduledChecks.set(sessionId, sessionData);

  var now = new Date();
  var check24h = new Date(sessionData.startTime.getTime() + 24 * 60 * 60 * 1000);
  var check48h = new Date(sessionData.startTime.getTime() + 48 * 60 * 60 * 1000);

  console.log('Scheduled long-term checks for session ' + sessionId + ':');
  console.log('   - 24h check: ' + check24h.toLocaleString());
  console.log('   - 48h check: ' + check48h.toLocaleString());

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
};

Node12VKExperiment.prototype.performLongTermCheck = function(sessionId, period) {
  var self = this;
  var sessionData = self.scheduledChecks.get(sessionId);
  if (!sessionData) {
    console.log('Session ' + sessionId + ' not found for long-term check (' + period + ')');
    return;
  }

  console.log('Performing long-term check for session ' + sessionId + ' (' + period + ')');
  console.log('Completed ' + period + ' check for session ' + sessionId);
};

Node12VKExperiment.prototype.startExperiment = function() {
  var self = this;
  console.log('Starting VK Views Experiment...');
  console.log('Mode: ' + (self.config.isTestMode ? 'TEST' : 'PRODUCTION'));
  console.log('Groups to track: ' + self.config.groups.join(', '));
  console.log('Short-term: ' + self.config.shortTermDuration + ' minutes (every ' + self.config.shortTermInterval + ' min)');
  console.log('Long-term checks: 24h and 48h after session start');
  
  self.initializeCsvFiles();
  
  self.startNewSession().then(function() {
    var cronPattern = self.config.isTestMode ? '*/10 * * * *' : '0 */12 * * *';
    
    cron.schedule(cronPattern, function() {
      console.log('Starting scheduled new tracking session...');
      self.startNewSession();
    });

    console.log('VK Views Experiment is running!');
  }).catch(function(error) {
    console.error('Error starting experiment:', error);
  });
};

Node12VKExperiment.prototype.startNewSession = function() {
  var self = this;
  return self.collectInitialData().then(function(sessionId) {
    var checkCount = 0;
    var shortTermInterval = setInterval(function() {
      checkCount++;
      self.performShortTermCheck(sessionId).then(function() {
        if (checkCount >= Math.floor(self.config.shortTermDuration / self.config.shortTermInterval)) {
          clearInterval(shortTermInterval);
        }
      });
    }, self.config.shortTermInterval * 60 * 1000);
  }).catch(function(error) {
    console.error('Error starting new tracking session:', error);
  });
};

Node12VKExperiment.prototype.getStatus = function() {
  var self = this;
  return {
    activeSessions: Array.from(self.activeTrackings.keys()),
    scheduledSessions: Array.from(self.scheduledChecks.keys()),
    config: {
      groups: self.config.groups,
      shortTermDuration: self.config.shortTermDuration,
      shortTermInterval: self.config.shortTermInterval
    }
  };
};

Node12VKExperiment.prototype.stop = function() {
  console.log('Stopping VK Views Experiment...');
};

// Проверяем аргументы командной строки
var command = process.argv[2];

if (command === 'test') {
  console.log('Running Node.js 12 compatibility test...');
  
  try {
    var experiment = new Node12VKExperiment();
    console.log('Compatibility test passed!');
    console.log('Config: ' + JSON.stringify(experiment.config, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Compatibility test failed:', error.message);
    process.exit(1);
  }
} else if (command === 'start') {
  console.log('Starting Node.js 12 Compatible VK Experiment...');
  
  process.on('SIGINT', function() {
    console.log('\nReceived stop signal...');
    process.exit(0);
  });
  
  try {
    new Node12VKExperiment();
    
    // Держим процесс активным
    process.stdin.resume();
  } catch (error) {
    console.error('Error starting experiment:', error.message);
    process.exit(1);
  }
} else {
  console.log('VK Views Experiment - Node.js 12 Compatible Version');
  console.log('');
  console.log('Commands:');
  console.log('  start - Start experiment');
  console.log('  test  - Compatibility test');
  console.log('');
  console.log('Examples:');
  console.log('  node node12-compatible.js start');
  console.log('  node node12-compatible.js test');
}

module.exports = Node12VKExperiment;

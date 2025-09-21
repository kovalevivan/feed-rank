const { VK } = require('vk-io');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');

class VKExperiment {
  constructor() {
    this.vk = null;
    // Определяем тестовый режим
    const isTestMode = process.env.VK_EXPERIMENT_TEST_MODE === 'true';
    const testInterval = parseInt(process.env.VK_EXPERIMENT_TEST_INTERVAL) || 5;
    const productionInterval = parseInt(process.env.VK_EXPERIMENT_INTERVAL) || 30;
    
    this.config = {
      // Токен для эксперимента (отдельный от основного)
      accessToken: process.env.VK_EXPERIMENT_TOKEN || '033b5ad1033b5ad1033b5ad18b000beccb0033b033b5ad16b2dd6d4b4dc1ca34cf5232a',
      // Группы для отслеживания
      groups: process.env.VK_EXPERIMENT_GROUPS ? process.env.VK_EXPERIMENT_GROUPS.split(',') : ['chp_nn'],
      // Интервалы проверки
      shortTermDuration: isTestMode ? 30 : (8 * 60), // Для теста: 30 минут, для продакшена: 8 часов
      shortTermInterval: isTestMode ? testInterval : productionInterval, // Для теста: 5 минут, для продакшена: 30 минут
      isTestMode: isTestMode,
      // CSV файлы
      csvDir: path.join(__dirname, 'data'),
      shortTermCsv: 'short_term_views.csv',
      longTermCsv: 'long_term_views.csv'
    };
    
    this.activeTrackings = new Map(); // Для отслеживания активных сессий
    this.scheduledChecks = new Map(); // Для отложенных проверок через 24/48 часов
    
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
    
    console.log('🔬 VK Experiment service initialized');
  }

  async ensureDataDir() {
    try {
      await fs.mkdir(this.config.csvDir, { recursive: true });
    } catch (error) {
      console.error('Error creating data directory:', error);
    }
  }

  /**
   * Получение ID группы по имени
   */
  async resolveGroupId(groupName) {
    try {
      // Сначала пробуем через resolveScreenName
      if (isNaN(groupName)) {
        try {
          const resolved = await this.vk.api.utils.resolveScreenName({
            screen_name: groupName
          });
          
          if (resolved && resolved.type === 'group') {
            return resolved.object_id.toString();
          }
        } catch (error) {
          // Продолжаем попытки
        }
      }
      
      // Если не получилось, пробуем через getById
      try {
        const response = await this.vk.api.groups.getById({
          group_id: groupName
        });
        
        if (response && response.length > 0) {
          return response[0].id.toString();
        }
      } catch (error) {
        // Продолжаем попытки
      }

      // Если число, возвращаем как есть
      if (!isNaN(groupName)) {
        return groupName;
      }
      
      throw new Error(`Could not resolve group ID for ${groupName}`);
    } catch (error) {
      console.error(`Error resolving group ID for ${groupName}:`, error);
      throw error;
    }
  }

  /**
   * Получение постов группы
   */
  async fetchGroupPosts(groupId, count = 10) {
    try {
      const formattedGroupId = groupId.startsWith('-') ? groupId.substring(1) : groupId;
      
      const response = await this.vk.api.wall.get({
        owner_id: `-${formattedGroupId}`,
        count: count,
        extended: 1
      });
      
      return response.items;
    } catch (error) {
      console.error(`Error fetching posts for group ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Инициализация CSV файлов с заголовками
   */
  async initializeCsvFiles() {
    const shortTermPath = path.join(this.config.csvDir, this.config.shortTermCsv);
    const longTermPath = path.join(this.config.csvDir, this.config.longTermCsv);

    // Заголовки для файла краткосрочного отслеживания
    const shortTermHeaders = 'session_id,group_name,group_id,post_id,check_time,elapsed_minutes,views,likes,reposts,published_at,post_text_preview\n';
    
    // Заголовки для файла долгосрочного отслеживания
    const longTermHeaders = 'session_id,group_name,group_id,post_id,initial_views,views_24h,views_48h,growth_24h,growth_48h,published_at,post_text_preview\n';

    try {
      // Проверяем существуют ли файлы
      const shortTermExists = await this.fileExists(shortTermPath);
      const longTermExists = await this.fileExists(longTermPath);

      if (!shortTermExists) {
        await fs.writeFile(shortTermPath, shortTermHeaders, 'utf8');
        console.log('📊 Created short-term CSV file with headers');
      }

      if (!longTermExists) {
        await fs.writeFile(longTermPath, longTermHeaders, 'utf8');
        console.log('📊 Created long-term CSV file with headers');
      }
    } catch (error) {
      console.error('Error initializing CSV files:', error);
    }
  }

  async fileExists(filepath) {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Генерация уникального ID сессии
   */
  generateSessionId() {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  }

  /**
   * Сбор исходных данных для новой сессии отслеживания
   */
  async collectInitialData() {
    console.log('🔍 Starting new data collection session...');
    
    const sessionId = this.generateSessionId();
    const sessionData = {
      sessionId,
      startTime: new Date(),
      groups: new Map(),
      checksRemaining: Math.floor(this.config.shortTermDuration / this.config.shortTermInterval), // Количество проверок зависит от режима
      currentCheck: 0
    };

    // Собираем данные по всем группам
    for (const groupName of this.config.groups) {
      try {
        console.log(`📊 Collecting initial data for group: ${groupName}`);
        
        const groupId = await this.resolveGroupId(groupName);
        const posts = await this.fetchGroupPosts(groupId, 10); // Берем 10 последних постов

        const groupData = {
          groupName,
          groupId,
          posts: new Map()
        };

        // Сохраняем информацию о каждом посте
        for (const post of posts) {
          const postData = {
            postId: post.id.toString(),
            initialViews: post.views?.count || 0,
            initialLikes: post.likes?.count || 0,
            initialReposts: post.reposts?.count || 0,
            publishedAt: new Date(post.date * 1000),
            textPreview: (post.text || '').substring(0, 100).replace(/\n/g, ' ').replace(/"/g, '""')
          };
          
          groupData.posts.set(postData.postId, postData);
        }

        sessionData.groups.set(groupName, groupData);
        console.log(`✅ Collected data for ${posts.length} posts from ${groupName}`);
        
      } catch (error) {
        console.error(`❌ Failed to collect initial data for ${groupName}:`, error);
      }
    }

    // Сохраняем сессию
    this.activeTrackings.set(sessionId, sessionData);
    
    // Записываем первоначальные данные в CSV
    await this.writeShortTermData(sessionData, 0);
    
    console.log(`🚀 Started tracking session ${sessionId} for ${sessionData.groups.size} groups`);
    
    return sessionId;
  }

  /**
   * Запись данных краткосрочного отслеживания в CSV
   */
  async writeShortTermData(sessionData, elapsedMinutes) {
    const shortTermPath = path.join(this.config.csvDir, this.config.shortTermCsv);
    
    let csvContent = '';
    
    for (const [groupName, groupData] of sessionData.groups) {
      try {
        // Получаем текущие данные постов
        const currentPosts = await this.fetchGroupPosts(groupData.groupId, 15); // Берем больше для надежности
        
        for (const [postId, postData] of groupData.posts) {
          const currentPost = currentPosts.find(p => p.id.toString() === postId);
          
          if (currentPost) {
            const currentViews = currentPost.views?.count || 0;
            const currentLikes = currentPost.likes?.count || 0;
            const currentReposts = currentPost.reposts?.count || 0;
            
            csvContent += `"${sessionData.sessionId}","${groupName}","${groupData.groupId}","${postId}","${new Date().toISOString()}",${elapsedMinutes},${currentViews},${currentLikes},${currentReposts},"${postData.publishedAt.toISOString()}","${postData.textPreview}"\n`;
          }
        }
      } catch (error) {
        console.error(`Error collecting data for group ${groupName}:`, error);
      }
    }
    
    if (csvContent) {
      try {
        await fs.appendFile(shortTermPath, csvContent, 'utf8');
        console.log(`📝 Recorded data for session ${sessionData.sessionId} (${elapsedMinutes} min)`);
      } catch (error) {
        console.error('Error writing to short-term CSV:', error);
      }
    }
  }

  /**
   * Запись данных долгосрочного отслеживания в CSV
   */
  async writeLongTermData(sessionData, period) {
    const longTermPath = path.join(this.config.csvDir, this.config.longTermCsv);
    
    let csvContent = '';
    
    for (const [groupName, groupData] of sessionData.groups) {
      try {
        const currentPosts = await this.fetchGroupPosts(groupData.groupId, 15);
        
        for (const [postId, postData] of groupData.posts) {
          const currentPost = currentPosts.find(p => p.id.toString() === postId);
          
          if (currentPost) {
            const currentViews = currentPost.views?.count || 0;
            const growth = currentViews - postData.initialViews;
            
            // Добавляем данные в зависимости от периода (24h или 48h)
            if (period === '24h') {
              postData.views24h = currentViews;
              postData.growth24h = growth;
            } else if (period === '48h') {
              postData.views48h = currentViews;
              postData.growth48h = growth;
              
              // Записываем в CSV только когда есть данные за оба периода
              if (postData.views24h !== undefined) {
                csvContent += `"${sessionData.sessionId}","${groupName}","${groupData.groupId}","${postId}",${postData.initialViews},${postData.views24h},${postData.views48h},${postData.growth24h},${postData.growth48h},"${postData.publishedAt.toISOString()}","${postData.textPreview}"\n`;
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error collecting long-term data for group ${groupName} (${period}):`, error);
      }
    }
    
    if (csvContent) {
      try {
        await fs.appendFile(longTermPath, csvContent, 'utf8');
        console.log(`📈 Recorded ${period} data for session ${sessionData.sessionId}`);
      } catch (error) {
        console.error(`Error writing to long-term CSV (${period}):`, error);
      }
    }
  }

  /**
   * Выполнение краткосрочного отслеживания (проверка каждые 30 минут)
   */
  async performShortTermCheck(sessionId) {
    const sessionData = this.activeTrackings.get(sessionId);
    if (!sessionData) {
      console.log(`❌ Session ${sessionId} not found for short-term check`);
      return;
    }

    sessionData.currentCheck++;
    const elapsedMinutes = sessionData.currentCheck * this.config.shortTermInterval;

    console.log(`🔍 Performing short-term check ${sessionData.currentCheck}/${sessionData.checksRemaining} for session ${sessionId} (${elapsedMinutes} min)`);
    
    await this.writeShortTermData(sessionData, elapsedMinutes);

    // Если это последняя проверка в краткосрочном периоде
    if (sessionData.currentCheck >= sessionData.checksRemaining) {
      console.log(`✅ Completed short-term tracking for session ${sessionId}`);
      
      // Планируем долгосрочные проверки
      this.scheduleLongTermChecks(sessionId);
      
      // Удаляем из активных отслеживаний
      this.activeTrackings.delete(sessionId);
    }
  }

  /**
   * Планирование долгосрочных проверок (24 и 48 часов)
   */
  scheduleLongTermChecks(sessionId) {
    const sessionData = this.activeTrackings.get(sessionId) || this.getSessionFromScheduled(sessionId);
    if (!sessionData) {
      console.log(`❌ Cannot schedule long-term checks for session ${sessionId} - session data not found`);
      return;
    }

    // Сохраняем данные сессии для долгосрочного отслеживания
    this.scheduledChecks.set(sessionId, sessionData);

    const now = new Date();
    const check24h = new Date(sessionData.startTime.getTime() + 24 * 60 * 60 * 1000);
    const check48h = new Date(sessionData.startTime.getTime() + 48 * 60 * 60 * 1000);

    console.log(`📅 Scheduled long-term checks for session ${sessionId}:`);
    console.log(`   - 24h check: ${check24h.toLocaleString()}`);
    console.log(`   - 48h check: ${check48h.toLocaleString()}`);

    // Планируем проверку через 24 часа
    if (check24h > now) {
      setTimeout(async () => {
        await this.performLongTermCheck(sessionId, '24h');
      }, check24h.getTime() - now.getTime());
    }

    // Планируем проверку через 48 часов
    if (check48h > now) {
      setTimeout(async () => {
        await this.performLongTermCheck(sessionId, '48h');
        // Удаляем данные сессии после финальной проверки
        this.scheduledChecks.delete(sessionId);
      }, check48h.getTime() - now.getTime());
    }
  }

  /**
   * Выполнение долгосрочной проверки (24 или 48 часов)
   */
  async performLongTermCheck(sessionId, period) {
    const sessionData = this.scheduledChecks.get(sessionId);
    if (!sessionData) {
      console.log(`❌ Session ${sessionId} not found for long-term check (${period})`);
      return;
    }

    console.log(`🔍 Performing long-term check for session ${sessionId} (${period})`);
    
    await this.writeLongTermData(sessionData, period);
    
    console.log(`✅ Completed ${period} check for session ${sessionId}`);
  }

  /**
   * Получение данных сессии из запланированных проверок
   */
  getSessionFromScheduled(sessionId) {
    return this.scheduledChecks.get(sessionId);
  }

  /**
   * Запуск эксперимента
   */
  async startExperiment() {
    console.log('🚀 Starting VK Views Experiment...');
    console.log(`🔬 Mode: ${this.config.isTestMode ? 'TEST' : 'PRODUCTION'}`);
    console.log(`📊 Groups to track: ${this.config.groups.join(', ')}`);
    console.log(`⏱️  Short-term: ${this.config.shortTermDuration} minutes (every ${this.config.shortTermInterval} min)`);
    console.log(`📈 Long-term checks: 24h and 48h after session start`);
    
    await this.initializeCsvFiles();
    
    // Запускаем первую сессию немедленно
    await this.startNewSession();
    
    // Планируем регулярный запуск новых сессий
    const cronPattern = this.config.isTestMode ? '*/10 * * * *' : '0 */12 * * *'; // Тест: каждые 10 минут, Продакшн: каждые 12 часов
    cron.schedule(cronPattern, async () => {
      console.log('⏰ Starting scheduled new tracking session...');
      await this.startNewSession();
    });

    console.log('✅ VK Views Experiment is running!');
  }

  /**
   * Запуск новой сессии отслеживания
   */
  async startNewSession() {
    try {
      const sessionId = await this.collectInitialData();
      
      // Планируем краткосрочные проверки
      let checkCount = 0;
      const shortTermInterval = setInterval(async () => {
        checkCount++;
        await this.performShortTermCheck(sessionId);
        
        // Останавливаем интервал после завершения краткосрочного отслеживания
        if (checkCount >= Math.floor(this.config.shortTermDuration / this.config.shortTermInterval)) {
          clearInterval(shortTermInterval);
        }
      }, this.config.shortTermInterval * 60 * 1000); // Переводим в миллисекунды

    } catch (error) {
      console.error('❌ Error starting new tracking session:', error);
    }
  }

  /**
   * Получение статуса эксперимента
   */
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

  /**
   * Остановка эксперимента
   */
  stop() {
    console.log('🛑 Stopping VK Views Experiment...');
    // Здесь можно добавить логику для graceful shutdown
  }
}

module.exports = VKExperiment;

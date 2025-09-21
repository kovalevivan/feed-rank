#!/usr/bin/env node

const VKExperiment = require('./index');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * CLI интерфейс для управления экспериментом VK Views
 */

class VKExperimentCLI {
  constructor() {
    this.experiment = null;
  }

  showHelp() {
    console.log(`
🔬 VK Views Experiment CLI

Команды:
  start         - Запустить эксперимент
  start-test    - Запустить в тестовом режиме (5 мин интервалы, 30 мин общее время)
  status        - Показать статус эксперимента
  stop          - Остановить эксперимент
  test          - Тестовый сбор данных (однократно)
  help          - Показать эту справку

Переменные окружения:
  VK_EXPERIMENT_TOKEN        - Токен ВК для эксперимента
  VK_EXPERIMENT_GROUPS       - Группы для отслеживания (через запятую)
  VK_EXPERIMENT_TEST_MODE    - Тестовый режим (true/false)
  VK_EXPERIMENT_TEST_INTERVAL- Интервал в тестовом режиме (по умолчанию: 5 мин)

Примеры запуска:
  # Обычный режим
  VK_EXPERIMENT_TOKEN="your_token" node cli.js start
  
  # Тестовый режим (интервалы 5 минут)
  node cli.js start-test
`);
  }

  async start(testMode = false) {
    try {
      console.log(`🚀 Запуск эксперимента VK Views${testMode ? ' (ТЕСТОВЫЙ РЕЖИМ)' : ''}...`);
      
      if (!process.env.VK_EXPERIMENT_TOKEN) {
        console.error('❌ Не установлен VK_EXPERIMENT_TOKEN');
        console.log('💡 Установите переменную окружения или используйте тестовый токен:');
        console.log('   export VK_EXPERIMENT_TOKEN="033b5ad1033b5ad1033b5ad18b000beccb0033b033b5ad16b2dd6d4b4dc1ca34cf5232a"');
        process.exit(1);
      }

      // Устанавливаем тестовый режим
      if (testMode) {
        process.env.VK_EXPERIMENT_TEST_MODE = 'true';
        console.log('🧪 Включен тестовый режим: интервалы 5 минут, общее время 30 минут');
      }

      this.experiment = new VKExperiment();
      
      console.log('✅ Эксперимент запущен успешно!');
      console.log('📊 Данные будут сохраняться в папку: server/services/vk-experiment/data/');
      console.log('⏹️  Для остановки нажмите Ctrl+C');

      // Обработка сигнала завершения
      process.on('SIGINT', () => {
        console.log('\n🛑 Получен сигнал остановки...');
        this.stop();
        process.exit(0);
      });

      // Держим процесс активным
      process.stdin.resume();
      
    } catch (error) {
      console.error('❌ Ошибка при запуске эксперимента:', error.message);
      process.exit(1);
    }
  }

  async status() {
    try {
      if (!this.experiment) {
        console.log('⚪ Эксперимент не запущен');
        return;
      }

      const status = this.experiment.getStatus();
      
      console.log('📊 Статус эксперимента VK Views:');
      console.log(`   Режим: ${this.experiment.config.isTestMode ? '🧪 ТЕСТОВЫЙ' : '🚀 ПРОДАКШН'}`);
      console.log(`   Активные сессии: ${status.activeSessions.length}`);
      console.log(`   Запланированные проверки: ${status.scheduledSessions.length}`);
      console.log(`   Отслеживаемые группы: ${status.config.groups.join(', ')}`);
      console.log(`   Краткосрочное отслеживание: ${status.config.shortTermDuration} мин (каждые ${status.config.shortTermInterval} мин)`);

      if (status.activeSessions.length > 0) {
        console.log('\n🟢 Активные сессии:');
        status.activeSessions.forEach(sessionId => {
          console.log(`   - ${sessionId}`);
        });
      }

      if (status.scheduledSessions.length > 0) {
        console.log('\n🟡 Запланированные долгосрочные проверки:');
        status.scheduledSessions.forEach(sessionId => {
          console.log(`   - ${sessionId}`);
        });
      }

    } catch (error) {
      console.error('❌ Ошибка при получении статуса:', error.message);
    }
  }

  stop() {
    if (this.experiment) {
      this.experiment.stop();
      this.experiment = null;
      console.log('✅ Эксперимент остановлен');
    } else {
      console.log('⚪ Эксперимент не был запущен');
    }
  }

  async test() {
    try {
      console.log('🧪 Выполняется тестовый сбор данных...');
      
      if (!process.env.VK_EXPERIMENT_TOKEN) {
        console.error('❌ Не установлен VK_EXPERIMENT_TOKEN');
        return;
      }

      // Создаем временный экземпляр для теста
      const testExperiment = new VKExperiment();
      
      console.log('📊 Конфигурация эксперимента:');
      console.log(`   Группы: ${testExperiment.config.groups.join(', ')}`);
      console.log(`   Токен: ${testExperiment.config.accessToken ? '✅ Установлен' : '❌ Не установлен'}`);
      console.log(`   Папка данных: ${testExperiment.config.csvDir}`);

      // Тестируем получение данных из первой группы
      const firstGroup = testExperiment.config.groups[0];
      console.log(`\n🔍 Тестируем получение данных для группы: ${firstGroup}`);
      
      const groupId = await testExperiment.resolveGroupId(firstGroup);
      console.log(`   ID группы: ${groupId}`);
      
      const posts = await testExperiment.fetchGroupPosts(groupId, 5);
      console.log(`   Получено постов: ${posts.length}`);
      
      if (posts.length > 0) {
        console.log('\n📄 Примеры постов:');
        posts.slice(0, 3).forEach((post, index) => {
          console.log(`   ${index + 1}. ID: ${post.id}, Просмотры: ${post.views?.count || 0}, Лайки: ${post.likes?.count || 0}`);
          if (post.text) {
            console.log(`      Текст: ${post.text.substring(0, 80)}...`);
          }
        });
      }

      console.log('\n✅ Тестовый сбор данных завершен успешно!');
      
    } catch (error) {
      console.error('❌ Ошибка при тестовом сборе данных:', error.message);
    }
  }

  async run() {
    const command = process.argv[2];
    
    switch (command) {
      case 'start':
        await this.start(false);
        break;
      case 'start-test':
        await this.start(true);
        break;
      case 'status':
        await this.status();
        break;
      case 'stop':
        this.stop();
        break;
      case 'test':
        await this.test();
        break;
      case 'help':
      case undefined:
        this.showHelp();
        break;
      default:
        console.error(`❌ Неизвестная команда: ${command}`);
        this.showHelp();
        process.exit(1);
    }
  }
}

// Запускаем CLI только если файл выполняется напрямую
if (require.main === module) {
  const cli = new VKExperimentCLI();
  cli.run().catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
  });
}

module.exports = VKExperimentCLI;

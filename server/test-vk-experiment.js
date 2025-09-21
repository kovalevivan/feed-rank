#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки работоспособности VK Experiment
 */

require('dotenv').config();
const VKExperiment = require('./services/vk-experiment/index');

async function runBasicTest() {
  console.log('🧪 Запуск базового теста VK Experiment...\n');
  
  try {
    // Проверяем переменные окружения
    console.log('📋 Проверка конфигурации:');
    console.log(`   VK_EXPERIMENT_TOKEN: ${process.env.VK_EXPERIMENT_TOKEN ? '✅ Установлен' : '❌ Отсутствует'}`);
    console.log(`   VK_EXPERIMENT_GROUPS: ${process.env.VK_EXPERIMENT_GROUPS || 'chp_nn (по умолчанию)'}`);
    console.log('');

    // Устанавливаем тестовые значения, если не заданы
    if (!process.env.VK_EXPERIMENT_TOKEN) {
      process.env.VK_EXPERIMENT_TOKEN = '033b5ad1033b5ad1033b5ad18b000beccb0033b033b5ad16b2dd6d4b4dc1ca34cf5232a';
      console.log('🔧 Установлен тестовый токен');
    }
    
    if (!process.env.VK_EXPERIMENT_GROUPS) {
      process.env.VK_EXPERIMENT_GROUPS = 'chp_nn';
      console.log('🔧 Установлена тестовая группа: chp_nn');
    }

    console.log('');

    // Создаем экземпляр эксперимента
    console.log('🚀 Инициализация VK Experiment...');
    const experiment = new VKExperiment();
    
    // Получаем статус
    const status = experiment.getStatus();
    console.log('✅ Эксперимент инициализирован успешно');
    console.log(`   Конфигурация групп: ${status.config.groups.join(', ')}`);
    console.log(`   Краткосрочное отслеживание: ${status.config.shortTermDuration} минут`);
    console.log(`   Интервал проверок: ${status.config.shortTermInterval} минут`);
    console.log('');

    // Тестируем получение данных
    const testGroup = status.config.groups[0];
    console.log(`🔍 Тестирование получения данных для группы: ${testGroup}`);
    
    // Получаем ID группы
    const groupId = await experiment.resolveGroupId(testGroup);
    console.log(`   ✅ ID группы: ${groupId}`);
    
    // Получаем посты
    const posts = await experiment.fetchGroupPosts(groupId, 5);
    console.log(`   ✅ Получено постов: ${posts.length}`);
    
    if (posts.length > 0) {
      console.log('\n📄 Примеры постов:');
      posts.slice(0, 3).forEach((post, index) => {
        const textPreview = post.text ? post.text.substring(0, 60).replace(/\n/g, ' ') : '[без текста]';
        console.log(`   ${index + 1}. ID: ${post.id}`);
        console.log(`      Просмотры: ${post.views?.count || 0}`);
        console.log(`      Лайки: ${post.likes?.count || 0}`);
        console.log(`      Репосты: ${post.reposts?.count || 0}`);
        console.log(`      Дата: ${new Date(post.date * 1000).toLocaleString()}`);
        console.log(`      Текст: ${textPreview}...`);
        console.log('');
      });
    }

    // Проверяем создание CSV файлов
    console.log('📊 Проверка CSV файлов...');
    await experiment.initializeCsvFiles();
    console.log('   ✅ CSV файлы инициализированы');

    console.log('\n🎉 Все тесты пройдены успешно!');
    console.log('\n💡 Для запуска полного эксперимента используйте:');
    console.log('   node server/run-vk-experiment.js start');
    
  } catch (error) {
    console.error('\n❌ Ошибка при выполнении теста:', error.message);
    console.error('\n🔧 Возможные причины:');
    console.error('   - Неверный токен ВК');
    console.error('   - Нет доступа к интернету');
    console.error('   - Группа недоступна или не существует');
    console.error('   - Превышен лимит запросов к API ВК');
    
    process.exit(1);
  }
}

if (require.main === module) {
  runBasicTest();
}

module.exports = runBasicTest;

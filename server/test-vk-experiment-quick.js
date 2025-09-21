#!/usr/bin/env node

/**
 * Быстрый тест VK Experiment в тестовом режиме (5 минут интервалы)
 */

require('dotenv').config();

// Принудительно устанавливаем тестовые настройки
process.env.VK_EXPERIMENT_TEST_MODE = 'true';
process.env.VK_EXPERIMENT_TEST_INTERVAL = '5';

if (!process.env.VK_EXPERIMENT_TOKEN) {
  process.env.VK_EXPERIMENT_TOKEN = '033b5ad1033b5ad1033b5ad18b000beccb0033b033b5ad16b2dd6d4b4dc1ca34cf5232a';
}

if (!process.env.VK_EXPERIMENT_GROUPS) {
  process.env.VK_EXPERIMENT_GROUPS = 'chp_nn';
}

const VKExperiment = require('./services/vk-experiment/index');

async function runQuickTest() {
  console.log('🧪 Запуск БЫСТРОГО теста VK Experiment (5 мин интервалы)...\n');
  
  try {
    console.log('⚙️  Тестовые настройки:');
    console.log(`   Режим: ТЕСТОВЫЙ`);
    console.log(`   Интервал: 5 минут`);
    console.log(`   Общее время: 30 минут (6 проверок)`);
    console.log(`   Группы: ${process.env.VK_EXPERIMENT_GROUPS}`);
    console.log('');

    // Создаем экземпляр эксперимента
    console.log('🚀 Запуск тестового эксперимента...');
    const experiment = new VKExperiment();
    
    console.log('✅ Тестовый эксперимент запущен!');
    console.log('📊 Данные сохраняются в: server/services/vk-experiment/data/');
    console.log('');
    console.log('🕐 В тестовом режиме сбор данных происходит каждые 5 минут.');
    console.log('📈 Через 30 минут краткосрочное отслеживание завершится.');
    console.log('');
    console.log('⏹️  Для остановки нажмите Ctrl+C');

    // Обработка сигнала завершения
    process.on('SIGINT', () => {
      console.log('\n🛑 Получен сигнал остановки...');
      experiment.stop();
      console.log('✅ Тестовый эксперимент остановлен');
      process.exit(0);
    });

    // Держим процесс активным
    process.stdin.resume();
    
  } catch (error) {
    console.error('\n❌ Ошибка при запуске быстрого теста:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runQuickTest();
}

module.exports = runQuickTest;

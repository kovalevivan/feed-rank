#!/usr/bin/env node

/**
 * Точка входа для запуска эксперимента VK Views из корня проекта
 * Версия без dotenv - для серверов где не установлены зависимости
 * Использование: node server/run-vk-experiment-no-dotenv.js [команда]
 */

const path = require('path');

// Установим токен по умолчанию, если не задан
if (!process.env.VK_EXPERIMENT_TOKEN) {
  process.env.VK_EXPERIMENT_TOKEN = '033b5ad1033b5ad1033b5ad18b000beccb0033b033b5ad16b2dd6d4b4dc1ca34cf5232a';
}

// Установим группы по умолчанию, если не заданы  
if (!process.env.VK_EXPERIMENT_GROUPS) {
  process.env.VK_EXPERIMENT_GROUPS = 'chp_nn';
}

// Запускаем CLI
const VKExperimentCLI = require('./services/vk-experiment/cli-no-dotenv');

async function main() {
  console.log('🔬 VK Views Experiment Launcher (No DotEnv Version)');
  console.log('📁 Working directory:', process.cwd());
  console.log('🔑 Using token:', process.env.VK_EXPERIMENT_TOKEN ? '✅ Configured' : '❌ Missing');
  console.log('📊 Groups:', process.env.VK_EXPERIMENT_GROUPS || 'chp_nn');
  
  // Автоматически включаем тестовый режим если команда start-test
  const command = process.argv[2];
  if (command === 'start-test') {
    console.log('🧪 Test mode enabled: 5 min intervals, 30 min duration');
    process.env.VK_EXPERIMENT_TEST_MODE = 'true';
  }
  
  console.log('');
  
  const cli = new VKExperimentCLI();
  await cli.run();
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = main;

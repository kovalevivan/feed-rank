#!/usr/bin/env node
require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const VkSource = require('./models/VkSource');

const mongoUri = process.env.MONGODB_URI;

async function setDefaultPercentile() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🔄 УСТАНОВКА ДЕФОЛТНОГО ПЕРЦЕНТИЛЯ (p90)');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      directConnection: true
    });
    console.log('✅ Connected to MongoDB\n');

    // Найти все VK источники
    const sources = await VkSource.find({});
    console.log(`📊 Found ${sources.length} VK sources\n`);

    let updated = 0;
    let skipped = 0;

    for (const source of sources) {
      // Проверяем текущее значение
      const currentPercentile = source.customPercentile;
      
      if (currentPercentile === undefined || currentPercentile === null) {
        // Устанавливаем 90 для групп без значения
        source.customPercentile = 90;
        await source.save();
        console.log(`✅ ${source.name}: установлен p90 (не было значения)`);
        updated++;
      } else if (currentPercentile !== 90) {
        // Для групп с другим значением - показываем, но не меняем
        console.log(`ℹ️  ${source.name}: уже установлен p${currentPercentile} (оставлено)`);
        skipped++;
      } else {
        // Уже 90
        console.log(`✓  ${source.name}: уже p90`);
        skipped++;
      }
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 ИТОГИ:');
    console.log(`  ✅ Обновлено (установлено p90): ${updated}`);
    console.log(`  ⏭️  Пропущено (уже было значение): ${skipped}`);
    console.log('═══════════════════════════════════════════════════\n');

    await mongoose.disconnect();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

setDefaultPercentile();


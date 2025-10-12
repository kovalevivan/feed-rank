#!/usr/bin/env node

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const fs = require('fs');
const VkSource = require('./models/VkSource');

async function rollback() {
  const reportFile = process.argv[2];
  if (!reportFile) {
    console.error('❌ Укажите файл отчета: node rollback-deactivation.js <report.json>');
    process.exit(1);
  }
  
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/feedrank';
  
  await mongoose.connect(mongoUri);
  
  console.log('🔄 Откат изменений...');
  console.log('');
  
  let restored = 0;
  for (const item of report.results) {
    if (item.action === 'deactivated' && item.previousState === true) {
      const source = await VkSource.findById(item.id);
      if (source) {
        source.active = true;
        delete source.deactivatedAt;
        delete source.deactivatedReason;
        await source.save();
        console.log(`✅ Восстановлено: ${source.name}`);
        restored++;
      }
    }
  }
  
  console.log('');
  console.log(`✅ Восстановлено групп: ${restored}`);
  await mongoose.disconnect();
}

rollback().catch(err => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});

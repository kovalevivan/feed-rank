#!/usr/bin/env node

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const fs = require('fs');
const VkSource = require('./models/VkSource');

// Аргументы командной строки
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

async function deactivatePhase1Groups() {
  try {
    // Подключение к БД
    console.log('═'.repeat(80));
    console.log('🔄 ДЕАКТИВАЦИЯ ГРУПП ЭТАП 1');
    console.log('═'.repeat(80));
    console.log('');
    
    if (DRY_RUN) {
      console.log('🔍 РЕЖИМ: DRY RUN (тестовый запуск, изменения НЕ будут сохранены)');
    } else if (!FORCE) {
      console.log('⚠️  ДЛЯ РЕАЛЬНОГО ВЫПОЛНЕНИЯ используйте флаг --force');
      console.log('   Например: node deactivate-phase1-groups.js --force');
      console.log('');
      console.log('💡 Для тестового прогона используйте: node deactivate-phase1-groups.js --dry-run');
      console.log('');
      process.exit(0);
    } else {
      console.log('⚡ РЕЖИМ: РЕАЛЬНОЕ ВЫПОЛНЕНИЕ');
    }
    
    console.log('');
    
    // Подключение к MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/feedrank';
    console.log('🔌 Подключение к БД...');
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      directConnection: true
    });
    
    console.log('✅ Подключено к БД');
    console.log('');
    
    // Чтение списка URL из файла
    const urlsFile = 'PHASE1-urls.txt';
    if (!fs.existsSync(urlsFile)) {
      console.error(`❌ Файл ${urlsFile} не найден!`);
      console.error('   Сначала запустите: node create-phased-removal.js');
      process.exit(1);
    }
    
    const urls = fs.readFileSync(urlsFile, 'utf8')
      .split('\n')
      .map(u => u.trim())
      .filter(u => u && u.startsWith('https://vk.com/'));
    
    console.log(`📋 Загружено URL из файла: ${urls.length}`);
    console.log('');
    
    // Статистика
    const stats = {
      total: urls.length,
      found: 0,
      alreadyInactive: 0,
      deactivated: 0,
      notFound: 0,
      errors: 0
    };
    
    const results = [];
    const notFound = [];
    const errors = [];
    
    console.log('🔍 Обработка групп:');
    console.log('─'.repeat(80));
    console.log('');
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const groupName = url.replace('https://vk.com/', '');
      
      try {
        // Ищем группу в БД
        const source = await VkSource.findOne({ url: url });
        
        if (!source) {
          console.log(`${i + 1}/${urls.length} ❌ НЕ НАЙДЕНА: ${groupName}`);
          stats.notFound++;
          notFound.push({ url, groupName });
          continue;
        }
        
        stats.found++;
        
        // Проверяем текущий статус
        if (!source.active) {
          console.log(`${i + 1}/${urls.length} ⏭️  УЖЕ НЕАКТИВНА: ${source.name} (ID: ${source._id})`);
          stats.alreadyInactive++;
          results.push({
            url,
            name: source.name,
            id: source._id,
            action: 'already_inactive',
            previousState: source.active
          });
          continue;
        }
        
        // Деактивируем
        if (!DRY_RUN) {
          source.active = false;
          source.deactivatedAt = new Date();
          source.deactivatedReason = 'Phase 1: Small group with low engagement';
          await source.save();
        }
        
        console.log(`${i + 1}/${urls.length} ✅ ДЕАКТИВИРОВАНА: ${source.name} (ID: ${source._id})`);
        console.log(`   Подписчиков: ${source.membersCount?.toLocaleString() || 'N/A'}`);
        
        stats.deactivated++;
        results.push({
          url,
          name: source.name,
          id: source._id,
          action: 'deactivated',
          previousState: true,
          membersCount: source.membersCount
        });
        
      } catch (error) {
        console.error(`${i + 1}/${urls.length} ⚠️  ОШИБКА: ${groupName} - ${error.message}`);
        stats.errors++;
        errors.push({ url, groupName, error: error.message });
      }
    }
    
    console.log('');
    console.log('═'.repeat(80));
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
    console.log('═'.repeat(80));
    console.log('');
    console.log(`Всего групп в списке:        ${stats.total}`);
    console.log(`Найдено в БД:                ${stats.found}`);
    console.log(`Уже были неактивны:          ${stats.alreadyInactive}`);
    console.log(`Деактивировано:              ${stats.deactivated}`);
    console.log(`Не найдено в БД:             ${stats.notFound}`);
    console.log(`Ошибок:                      ${stats.errors}`);
    console.log('');
    
    if (stats.deactivated > 0) {
      if (DRY_RUN) {
        console.log('🔍 Это был тестовый прогон. Изменения НЕ сохранены.');
        console.log('   Для реального выполнения запустите:');
        console.log('   node deactivate-phase1-groups.js --force');
      } else {
        console.log('✅ Изменения успешно сохранены в БД!');
      }
    }
    
    console.log('');
    
    // Сохраняем результаты в файл
    const reportFile = `deactivation-report-${new Date().toISOString().split('T')[0]}.json`;
    const report = {
      timestamp: new Date().toISOString(),
      mode: DRY_RUN ? 'dry-run' : 'real',
      stats,
      results,
      notFound,
      errors
    };
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`📁 Отчет сохранен: ${reportFile}`);
    console.log('');
    
    // Если были группы не найдены или ошибки
    if (stats.notFound > 0) {
      console.log('⚠️  ГРУППЫ НЕ НАЙДЕНЫ В БД:');
      console.log('─'.repeat(80));
      notFound.forEach(({ url, groupName }) => {
        console.log(`   • ${groupName} (${url})`);
      });
      console.log('');
      console.log('   Возможно, эти группы были удалены ранее или URL изменился.');
      console.log('');
    }
    
    if (stats.errors > 0) {
      console.log('❌ ОШИБКИ ПРИ ОБРАБОТКЕ:');
      console.log('─'.repeat(80));
      errors.forEach(({ url, groupName, error }) => {
        console.log(`   • ${groupName}: ${error}`);
      });
      console.log('');
    }
    
    // Если нужен скрипт для отката
    if (!DRY_RUN && stats.deactivated > 0) {
      console.log('═'.repeat(80));
      console.log('🔄 ОТКАТ ИЗМЕНЕНИЙ');
      console.log('═'.repeat(80));
      console.log('');
      console.log('Если нужно откатить изменения, используйте:');
      console.log(`   node rollback-deactivation.js ${reportFile}`);
      console.log('');
      
      // Создаем скрипт для отката
      const rollbackScript = `#!/usr/bin/env node

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
        console.log(\`✅ Восстановлено: \${source.name}\`);
        restored++;
      }
    }
  }
  
  console.log('');
  console.log(\`✅ Восстановлено групп: \${restored}\`);
  await mongoose.disconnect();
}

rollback().catch(err => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});
`;
      
      fs.writeFileSync('rollback-deactivation.js', rollbackScript);
      fs.chmodSync('rollback-deactivation.js', '755');
      console.log('✅ Создан скрипт для отката: rollback-deactivation.js');
      console.log('');
    }
    
    console.log('═'.repeat(80));
    console.log('✅ ГОТОВО!');
    console.log('═'.repeat(80));
    
  } catch (error) {
    console.error('');
    console.error('═'.repeat(80));
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА');
    console.error('═'.repeat(80));
    console.error('');
    console.error(error);
    console.error('');
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Запуск
deactivatePhase1Groups();


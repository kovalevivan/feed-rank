# Автоматический еженедельный пересчёт порогов

## 📅 Расписание

**Каждое воскресенье в 3:00 AM** автоматически пересчитываются пороги виральности для всех активных VK групп.

## 🎯 Цель

Поддержание актуальности порогов в соответствии с текущими паттернами публикаций:
- Адаптация к сезонным изменениям активности
- Учёт роста/падения аудитории групп
- Корректировка при изменении частоты публикаций

## 🔧 Реализация

### Файл: `server/services/scheduler/index.js`

#### 1. Cron задача
```javascript
// Runs every Sunday at 3:00 AM
cron.schedule('0 3 * * 0', async () => {
  try {
    console.log('📊 Starting weekly threshold recalculation...');
    await recalculateAllVkThresholds();
  } catch (error) {
    console.error('Error in weekly threshold recalculation:', error);
  }
});
```

#### 2. Функция `recalculateAllVkThresholds()`

**Что делает:**
- Находит все активные VK источники (где `active !== false`)
- Пропускает источники с ручными порогами (`thresholdType === 'manual'`)
- Для каждой группы вызывает `vkService.updateSourceThreshold()`
- Использует текущий метод группы (по умолчанию `percentile` с p90)
- Логирует изменения и статистику

**Особенности:**
- Добавляет задержку 1 сек после каждых 10 групп (защита от rate limiting VK API)
- Логирует TOP-5 групп с наибольшими изменениями порога
- Возвращает детальную статистику выполнения

**Возвращаемые данные:**
```javascript
{
  updated: 145,        // Количество обновлённых групп
  failed: 2,           // Количество ошибок
  skipped: 9,          // Пропущено (ручные пороги)
  duration: 15.3,      // Длительность в минутах
  timestamp: Date      // Время выполнения
}
```

## 📊 Пример вывода в логах

```
═══════════════════════════════════════════════════
🔄 WEEKLY THRESHOLD RECALCULATION
═══════════════════════════════════════════════════
📊 Found 156 active VK sources

[1/156] bez_cenznn: 33,781 → 33,050 (-2.2%)
[2/156] nn800: 15,234 → 16,120 (+5.8%)
...
[156/156] rostownews: 80,351 → 19,901 (-75.2%)

═══════════════════════════════════════════════════
📊 WEEKLY RECALCULATION COMPLETED
  ✅ Updated: 145
  ⏭️  Skipped: 9 (manual thresholds)
  ❌ Failed: 2
  ⏱️  Duration: 15.3 minutes
═══════════════════════════════════════════════════

🔝 TOP-5 BIGGEST CHANGES:
  1. komunavolge: -99,646 (-54.9%)
  2. n_novgorod_online: -63,274 (-60.0%)
  3. rostownews: -60,450 (-75.2%)
  4. niz52: -58,262 (-83.7%)
  5. ekatskoechtivo: -58,150 (-59.0%)

✅ Weekly threshold recalculation completed successfully
```

## 🚀 Ручной запуск

Если нужно запустить пересчёт вручную (не дожидаясь воскресенья):

### Из Docker контейнера:
```bash
docker-compose exec backend node -e "
  const scheduler = require('./services/scheduler');
  scheduler.recalculateAllVkThresholds()
    .then(result => {
      console.log('Result:', result);
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
"
```

### Локально:
```bash
cd server
node -e "
  require('dotenv').config();
  const mongoose = require('mongoose');
  const scheduler = require('./services/scheduler');
  
  (async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const result = await scheduler.recalculateAllVkThresholds();
    console.log('Result:', result);
    await mongoose.disconnect();
  })();
"
```

## ⚙️ Настройка расписания

Cron выражение: `0 3 * * 0`

| Поле | Значение | Описание |
|------|----------|----------|
| Минуты | 0 | В начале часа |
| Часы | 3 | 3:00 AM |
| День месяца | * | Любой день |
| Месяц | * | Любой месяц |
| День недели | 0 | Воскресенье (0 = воскресенье) |

### Примеры альтернативных расписаний:

```javascript
// Каждый день в 2:00 AM
'0 2 * * *'

// Каждый понедельник в 1:00 AM
'0 1 * * 1'

// Дважды в неделю: вторник и пятница в 3:00 AM
'0 3 * * 2,5'

// Каждые 3 дня в полночь
'0 0 */3 * *'
```

## 📈 Преимущества автоматического пересчёта

1. **Актуальность данных**: Пороги всегда соответствуют текущим паттернам
2. **Снижение шума**: Своевременная корректировка для групп с изменившейся активностью
3. **Без ручного вмешательства**: Полностью автоматизированный процесс
4. **Детальная статистика**: Логи показывают все изменения

## 🔍 Мониторинг

Проверить статус последнего пересчёта:
```bash
docker-compose logs backend | grep "WEEKLY RECALCULATION"
```

Проверить расписание активных задач:
```bash
docker-compose exec backend node -e "
  const scheduler = require('./services/scheduler');
  const jobs = scheduler.getCronJobs();
  console.log('Active jobs:', Object.keys(jobs).length);
"
```

## 📝 Changelog

**2025-10-12**
- ✅ Добавлен автоматический еженедельный пересчёт порогов
- ✅ Используется метод p90 (90-й перцентиль) по умолчанию
- ✅ Добавлена защита от rate limiting VK API
- ✅ Добавлено логирование TOP-5 изменений
- ✅ Пропуск групп с ручными порогами

---

**Версия:** v2.2 (Auto Weekly Recalculation)  
**Дата:** 12 октября 2025


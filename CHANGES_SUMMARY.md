# Итоговая сводка изменений

## 📊 Дата: 12 октября 2025

### 1️⃣ Повышение перцентиля: p85 → p90

**Изменения:**
- Дефолтный перцентиль изменён с 85 на 90
- Теперь топ-10% постов считаются вирусными (было 15%)
- Более строгий критерий виральности

**Результаты для bez_cenznn:**
- Старый порог (p85): 29,836 просмотров
- Новый порог (p90): **33,050 просмотров** ✅
- Изменение: +10.8%
- Вирусных постов: 10.3% (оптимально!)

**Файлы:**
- `server/services/vk/index.js`
- `server/models/VkSource.js`

**Коммит:** `fb1d186`

---

### 2️⃣ Автоматический еженедельный пересчёт порогов

**Что добавлено:**
- Cron задача: каждое воскресенье в 3:00 AM
- Функция `recalculateAllVkThresholds()` в scheduler
- Автоматический пересчёт для всех активных VK групп
- Пропуск групп с ручными порогами
- Защита от rate limiting (задержка 1 сек на 10 групп)
- Детальное логирование и статистика

**Расписание:**
```
Cron: 0 3 * * 0
Время: Каждое воскресенье в 3:00 AM
```

**Файлы:**
- `server/services/scheduler/index.js`

**Коммит:** `300735c`

---

## 🚀 Развёртывание

### ✅ Выполнено:
1. Код закоммичен и запушен в GitHub
2. Backend Docker образ пересобран
3. Backend контейнер перезапущен
4. Scheduler запущен и работает
5. Еженедельная задача зарегистрирована

### 📊 Подтверждение:
```
✅ Scheduler service initialized
✅ Weekly threshold recalculation scheduled: Every Sunday at 3:00 AM
✅ Function exists and is callable
```

---

## 📈 Статистика пересчёта (от 12.10.2025)

**Итоги пересчёта всех групп с p90:**
- ✅ Обновлено: **156 групп**
- ❌ Ошибок: **0**
- ⏱️ Длительность: ~25 минут

**ТОП-5 изменений:**
1. komunavolge: -99,646 (-54.9%)
2. n_novgorod_online: -63,274 (-60.0%)
3. rostownews: -60,450 (-75.2%)
4. niz52: -58,262 (-83.7%)
5. ekatskoechtivo: -58,150 (-59.0%)

---

## 🔧 Ручной запуск пересчёта

Если нужно запустить пересчёт вручную (не дожидаясь воскресенья):

```bash
ssh root@5.129.202.200
cd /root/feed-rank
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

---

## 📚 Документация

### Созданные файлы:
1. **PERCENTILE_P90_UPDATE.md** - Подробное описание изменения перцентиля
2. **WEEKLY_THRESHOLD_RECALCULATION.md** - Полная документация по автоматическому пересчёту
3. **CHANGES_SUMMARY.md** - Этот файл (краткая сводка)

---

## ✅ Проверка работы

### Проверить статус scheduler:
```bash
docker logs feedrank-backend 2>&1 | grep -i "weekly"
```

### Проверить последний пересчёт:
```bash
docker logs feedrank-backend 2>&1 | grep "WEEKLY RECALCULATION"
```

### Проверить порог конкретной группы:
```bash
docker-compose exec backend node -e "
  const mongoose = require('mongoose');
  const VkSource = require('./models/VkSource');
  (async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const source = await VkSource.findOne({ name: 'bez_cenznn' });
    console.log('Threshold:', source.calculatedThreshold);
    console.log('Percentile:', source.lastPostsData.percentileUsed);
    await mongoose.disconnect();
  })();
"
```

---

## 💡 Ключевые преимущества

### 1. Перцентильный подход (p90):
- ✅ Более робастный к выбросам
- ✅ Предсказуемый процент виральных постов (~10%)
- ✅ Адаптивность к разным типам групп

### 2. Временное окно (7 дней):
- ✅ Актуальные данные
- ✅ Не завышает пороги для редко постящих групп
- ✅ Автоматическое расширение при недостатке данных

### 3. Автоматический пересчёт:
- ✅ Без ручного вмешательства
- ✅ Адаптация к сезонным изменениям
- ✅ Поддержание актуальности порогов

---

**Версия системы:** v2.2  
**Статус:** ✅ Готово к работе  
**Следующий автоматический пересчёт:** Воскресенье, 13 октября 2025, 3:00 AM


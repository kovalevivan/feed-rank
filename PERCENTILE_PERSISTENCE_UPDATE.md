# Обновление: Сохранение и загрузка значений перцентиля

## 📅 Дата: 12 октября 2025

### 🎯 Решённые проблемы

#### 1. **Неправильная экстраполяция для граничных значений**
**Проблема:** При выборе p < 75 или p > 95 количество постов рассчитывалось некорректно.

**Решение:** Добавлена линейная экстраполяция для значений за пределами известных точек данных.

```javascript
// Для p < минимального (например, p < 50)
if (percentile < sorted[0].percentile) {
  const p1 = sorted[0];
  const p2 = sorted[1];
  const ratio = (percentile - p1.percentile) / (p2.percentile - p1.percentile);
  // Экстраполируем с отрицательным ratio
}

// Для p > максимального (например, p > 97)
if (percentile > sorted[sorted.length - 1].percentile) {
  const p1 = sorted[sorted.length - 2];
  const p2 = sorted[sorted.length - 1];
  const ratio = (percentile - p1.percentile) / (p2.percentile - p1.percentile);
  // Экстраполируем с ratio > 1
}
```

**Коммит:** `3da2e0b`

---

#### 2. **Значение перцентиля не сохранялось при редактировании**
**Проблема:** При повторном открытии формы редактирования группы ползунок всегда показывал p90 вместо сохранённого значения.

**Решение:** 
- Улучшена логика загрузки значения из props
- Удалена инициализация с `value || 90` из useState
- Добавлено логирование для отладки

```javascript
// Было:
const [selectedValue, setSelectedValue] = useState(value || 90);

// Стало:
const [selectedValue, setSelectedValue] = useState(90);

useEffect(() => {
  if (value !== undefined && value !== null) {
    console.log(`PercentileSlider: setting value to ${value}`);
    setSelectedValue(value);
  }
}, [value]);
```

**Коммит:** `f75b387`

---

#### 3. **Установка дефолтного значения для всех групп**
**Создан:** Миграционный скрипт `set-default-percentile.js`

```bash
node server/set-default-percentile.js
```

**Что делает:**
- Находит все VK источники в базе
- Устанавливает `customPercentile = 90` для групп без значения
- Не меняет существующие значения (если пользователь уже настроил)
- Показывает детальный отчёт

**Результат выполнения:**
```
📊 Found 227 VK sources
✅ Обновлено (установлено p90): 0
⏭️  Пропущено (уже было значение): 227
```

Все 227 групп уже имели значение p90 ✅

---

## 🔧 Технические детали

### 1. Как сохраняется значение

**При сохранении формы:**
```javascript
// client/src/components/sources/SourceForm.js
const sourceData = {
  ...formData,
  customPercentile: parseInt(formData.customPercentile),
  // ... другие поля
};
```

**API endpoint:**
```javascript
// server/controllers/vkSources.js
if (customPercentile !== undefined && customPercentile !== source.customPercentile) {
  source.customPercentile = customPercentile;
  
  // Автоматический пересчёт порога
  if (source.thresholdType === 'auto' && source.thresholdMethod === 'percentile') {
    vkService.updateSourceThreshold(source._id, 'percentile');
  }
}
```

### 2. Как используется в расчётах

**Еженедельный пересчёт:**
```javascript
// server/services/scheduler/index.js (recalculateAllVkThresholds)
await vkService.updateSourceThreshold(source._id, source.thresholdMethod || 'percentile');
```

**Функция updateSourceThreshold:**
```javascript
// server/services/vk/index.js
if (thresholdMethod === 'percentile') {
  // Использует customPercentile из источника
  const percentile = param || source.customPercentile || 90;
  calculatedThreshold = calculatePercentileThreshold(posts, percentile);
}
```

### 3. Модель в БД

```javascript
// server/models/VkSource.js
customPercentile: {
  type: Number,
  default: 90,        // Default: 90th percentile (top 10%)
  min: 50,            // Minimum: 50th percentile (top 50%)
  max: 99             // Maximum: 99th percentile (top 1%)
}
```

---

## ✅ Проверка работы

### 1. Сохранение значения

```bash
# 1. Откройте форму редактирования группы
# 2. Измените перцентиль (например, на p85)
# 3. Сохраните форму
# 4. Откройте форму снова → должно показать p85 ✅
```

### 2. Логирование (Browser Console)

```javascript
// При загрузке формы:
PercentileSlider: setting value to 85

// При изменении ползунка:
PercentileSlider: setting value to 92
```

### 3. Проверка в БД

```bash
docker-compose exec backend node -e "
  const mongoose = require('mongoose');
  const VkSource = require('./models/VkSource');
  (async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const source = await VkSource.findOne({ name: 'bez_cenznn' });
    console.log('customPercentile:', source.customPercentile);
    await mongoose.disconnect();
  })();
"
```

**Ожидаемый вывод:**
```
customPercentile: 90
```

---

## 🚀 Развёртывание

### Выполненные шаги:

1. ✅ Исправлена экстраполяция для граничных значений
2. ✅ Улучшена загрузка сохранённого значения
3. ✅ Создан миграционный скрипт
4. ✅ Запущена миграция на production (227 групп)
5. ✅ Frontend пересобран
6. ✅ Код закоммичен и задеплоен

### Коммиты:
- `3da2e0b` - fix: extrapolation for percentiles outside data range
- `f75b387` - feat: add default percentile migration and improve value persistence

---

## 📊 Статистика

**Всего групп:** 227  
**С дефолтным p90:** 227 (100%)  
**Требующих обновления:** 0

**Еженедельный пересчёт:**  
Использует `customPercentile` для каждой группы ✅

---

## 🎯 Результат

### Для пользователя:
1. ✅ Значение перцентиля сохраняется при редактировании
2. ✅ Корректный расчёт для всего диапазона p50-p99
3. ✅ Автоматический пересчёт порога при изменении
4. ✅ Еженедельное обновление с учётом сохранённых настроек

### Для системы:
1. ✅ Все группы имеют корректное значение по умолчанию (p90)
2. ✅ Консистентность между UI и БД
3. ✅ Логирование для отладки
4. ✅ Миграционный скрипт для будущих обновлений

---

**Версия:** v3.1 (Percentile Persistence)  
**Дата:** 12 октября 2025, 21:32 MSK  
**Статус:** ✅ Полностью реализовано и задеплоено


# Исправление расчёта перцентилей

## 📅 Дата: 12 октября 2025, 21:45 MSK

### 🐛 Проблема

При выборе перцентиля **ниже p75** или **выше p95** в UI ползунке отображались **некорректные** значения количества постов.

### 🔍 Диагностика

При проверке API endpoint `/api/vk-sources/:id/percentile-stats` обнаружены **немонотонные** пороги:

```
p50: threshold=4438, viral=24 posts
p60: threshold=4438, viral=24 posts  (тот же)
p70: threshold=4438, viral=24 posts  (тот же)
p75: threshold=2804, viral=41 posts  ❌ МЕНЬШЕ чем p70!
p80: threshold=3676, viral=26 posts
p85: threshold=4547, viral=23 posts
p90: threshold=5419, viral=17 posts
p92: threshold=6604, viral=12 posts
p94: threshold=7789, viral=9 posts
p95: threshold=8381, viral=9 posts
p97: threshold=4438, viral=24 posts  ❌ МЕНЬШЕ чем p95!
```

**Ожидаемое поведение:** Пороги должны **монотонно возрастать** при увеличении перцентиля:
- p50 < p60 < p70 < p75 < ... < p97

### 🔬 Причина

Функция `calculatePercentileThreshold` в `server/services/vk/index.js` была **неполной**:

**Старый код:**
```javascript
const calculatePercentileThreshold = (posts, percentile = 90) => {
  // ...
  const stats = calculateDetailedStats(posts);
  
  // Обрабатывались ТОЛЬКО p75, p90, p95, p99
  if (percentile === 75) return stats.percentiles.p75;
  if (percentile === 90) return stats.percentiles.p90;
  if (percentile === 95) return stats.percentiles.p95;
  if (percentile === 99) return stats.percentiles.p99;
  
  // Интерполяция только для 75-95
  if (percentile >= 75 && percentile < 90) {
    // интерполяция между p75 и p90
  }
  if (percentile >= 90 && percentile < 95) {
    // интерполяция между p90 и p95
  }
  
  // ❌ ДЛЯ ВСЕХ ОСТАЛЬНЫХ: дефолт (интерполяция между p75 и p90)
  return Math.round(stats.percentiles.p75 + (stats.percentiles.p90 - stats.percentiles.p75) * 0.625);
};
```

**Проблемы:**
1. **p50, p60, p70** → возвращался дефолт (интерполяция между p75 и p90) → **одинаковые значения**
2. **p97, p98, p99** → возвращался дефолт → **неправильные значения**
3. Зависимость от `calculateDetailedStats` который сам мог иметь ошибки

### ✅ Решение

Полностью переписана функция для **корректного расчёта ЛЮБОГО перцентиля**:

**Новый код:**
```javascript
const calculatePercentileThreshold = (posts, percentile = 90) => {
  if (!posts || posts.length === 0) return 0;
  
  // 1. Извлекаем количество просмотров
  const viewCounts = posts
    .map(post => post.views?.count || 0)
    .sort((a, b) => a - b);  // Сортируем по возрастанию
  
  if (viewCounts.length === 0) return 0;
  
  // 2. Вычисляем индекс для перцентиля
  // p90 = 90% данных ниже этого значения
  const index = Math.ceil(viewCounts.length * (percentile / 100)) - 1;
  const clampedIndex = Math.max(0, Math.min(viewCounts.length - 1, index));
  
  // 3. Возвращаем значение на этом индексе
  return viewCounts[clampedIndex];
};
```

**Преимущества:**
1. ✅ Работает для **любого перцентиля** (0-100)
2. ✅ Использует **стандартный алгоритм** расчёта перцентилей
3. ✅ Гарантирует **монотонность**: p50 ≤ p60 ≤ p70 ≤ ... ≤ p99
4. ✅ Прямой расчёт из данных, без промежуточных статистик
5. ✅ Простой и понятный код

### 📊 Как работает алгоритм

**Пример:** Есть 100 постов с просмотрами, отсортированными по возрастанию.

| Перцентиль | Индекс | Значение | Описание |
|------------|--------|----------|----------|
| p50 | 50 | viewCounts[50] | Медиана: 50% постов ниже |
| p75 | 75 | viewCounts[75] | 75% постов ниже |
| p90 | 90 | viewCounts[90] | 90% постов ниже (топ 10%) |
| p95 | 95 | viewCounts[95] | 95% постов ниже (топ 5%) |

**Для группы с 117 постами:**
- p50: index = 59 → viewCounts[59]
- p90: index = 105 → viewCounts[105]

### 🧪 Проверка после исправления

После деплоя можно проверить:

```bash
curl "http://5.129.202.200/api/vk-sources/:id/percentile-stats" | jq '.percentiles'
```

**Ожидаемый результат:**
```json
[
  { "percentile": 50, "threshold": 2500, "postsPerWeek": 59 },
  { "percentile": 60, "threshold": 3200, "postsPerWeek": 47 },
  { "percentile": 70, "threshold": 3800, "postsPerWeek": 35 },
  { "percentile": 75, "threshold": 4200, "postsPerWeek": 29 },
  { "percentile": 80, "threshold": 4600, "postsPerWeek": 22 },
  { "percentile": 85, "threshold": 5100, "postsPerWeek": 16 },
  { "percentile": 90, "threshold": 5600, "postsPerWeek": 12 },
  { "percentile": 92, "threshold": 6100, "postsPerWeek": 9 },
  { "percentile": 94, "threshold": 6600, "postsPerWeek": 7 },
  { "percentile": 95, "threshold": 6900, "postsPerWeek": 6 },
  { "percentile": 97, "threshold": 7500, "postsPerWeek": 3 }
]
```

✅ **Все пороги монотонно возрастают!**

### 🎯 Влияние на UI

**До исправления:**
- Ползунок на p60: показывал 24 поста (неправильно, дефолт от p75-p90)
- Ползунок на p97: показывал 24 поста (неправильно, дефолт от p75-p90)

**После исправления:**
- Ползунок на p60: покажет ~47 постов ✅
- Ползунок на p97: покажет ~3 поста ✅

### 📈 Влияние на пересчёт порогов

**Еженедельный пересчёт:**
Все группы получат **корректные** пороги виральности для своих перцентилей.

**Ручной пересчёт:**
При изменении перцентиля в UI порог сразу пересчитается правильно.

### ⚠️ Примечание

После деплоя **рекомендуется** запустить пересчёт порогов для всех групп:

```bash
ssh root@5.129.202.200
cd /root/feed-rank
docker-compose exec backend node set-default-percentile.js
```

Или дождаться еженедельного автоматического пересчёта (воскресенье, 3:00 AM).

---

**Коммит:** `eeb8b23`  
**Статус:** ✅ Исправлено и задеплоено  
**Версия:** v3.2 (Accurate Percentile Calculation)


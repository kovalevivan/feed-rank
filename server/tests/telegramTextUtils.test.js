const test = require('node:test');
const assert = require('node:assert/strict');
const { stripTelegramFooter } = require('../utils/telegramTextUtils');

test('removes a common subscription footer', () => {
  const text = [
    'В городе открыли новый участок дороги.',
    '',
    'Подписывайтесь на наш канал: @city_news',
    'Предложить новость: @city_bot'
  ].join('\n');

  assert.equal(stripTelegramFooter(text), 'В городе открыли новый участок дороги.');
});

test('removes known MAX and contact footer variants', () => {
  const footers = [
    'Здесь мы всегда на связи. Подписывайтесь',
    '🔴 Подписаться | Прислать новости',
    '📲 Подписаться на нас в МАКС',
    '📲 Читайте нас в МАКС\n😊 Подписаться | Прислать новость'
  ];

  for (const footer of footers) {
    assert.equal(
      stripTelegramFooter(`Основной текст новости.\n\n${footer}`),
      'Основной текст новости.',
      footer
    );
  }
});

test('removes a compact standalone Telegram link', () => {
  const text = [
    'Основной текст новости.',
    '',
    'Наш Telegram | https://t.me/example_channel'
  ].join('\n');

  assert.equal(stripTelegramFooter(text), 'Основной текст новости.');
});

test('removes a footer without a blank separator', () => {
  const text = [
    'Основной текст новости.',
    'Подписаться: t.me/example_channel'
  ].join('\n');

  assert.equal(stripTelegramFooter(text), 'Основной текст новости.');
});

test('preserves Telegram links inside the news body', () => {
  const text = [
    'Губернатор написал в https://t.me/governor/123 о новом решении.',
    '',
    'Документ вступит в силу завтра.'
  ].join('\n');

  assert.equal(stripTelegramFooter(text), text);
});

test('preserves an ordinary final paragraph with a mention', () => {
  const text = 'Комментарий для редакции дал представитель @example_user после заседания.';

  assert.equal(stripTelegramFooter(text), text);
});

test('preserves a source attribution with a Telegram link', () => {
  const text = [
    'Основной текст новости.',
    '',
    'Источник: https://t.me/example_channel/123'
  ].join('\n');

  assert.equal(stripTelegramFooter(text), text);
});

test('keeps media-only messages empty', () => {
  assert.equal(stripTelegramFooter(''), '');
  assert.equal(stripTelegramFooter(null), '');
});

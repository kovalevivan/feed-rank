const test = require('node:test');
const assert = require('node:assert/strict');
const { detectAdvertisement } = require('../utils/advertisingUtils');

test('detects explicit Russian advertising labels', () => {
  assert.equal(detectAdvertisement('#реклама\nПопробуйте новый сервис').isAdvertisement, true);
  assert.equal(detectAdvertisement('РЕКЛАМА: квартиры в новом районе').isAdvertisement, true);
  assert.equal(detectAdvertisement('На правах рекламы\nНовый жилой комплекс').isAdvertisement, true);
});

test('detects ERID and advertiser disclosures', () => {
  assert.equal(detectAdvertisement('erid: 2Vtzqv12345\nПодробнее на сайте').isAdvertisement, true);
  assert.equal(detectAdvertisement('Рекламодатель: ООО «Пример»').isAdvertisement, true);
});

test('detects promo codes and commercial calls to action', () => {
  assert.equal(detectAdvertisement('Промокод: SUMMER25 даст скидку 25%').isAdvertisement, true);
  assert.equal(
    detectAdvertisement('Большая распродажа: успейте заказать товар со скидкой').isAdvertisement,
    true
  );
});

test('does not reject news that merely discusses advertising or discounts', () => {
  assert.equal(
    detectAdvertisement('Депутаты обсудили новый закон о рекламе в интернете.').isAdvertisement,
    false
  );
  assert.equal(
    detectAdvertisement('Центробанк сообщил о снижении скидок на страховые продукты.').isAdvertisement,
    false
  );
});

test('does not treat a standard channel advertising contact footer as an ad', () => {
  const text = [
    'В городе открыли новую станцию метро.',
    '',
    'По вопросам рекламы: @example_manager'
  ].join('\n');

  assert.equal(detectAdvertisement(text).isAdvertisement, false);
});

test('does not reject empty or media-only posts', () => {
  assert.equal(detectAdvertisement('').isAdvertisement, false);
  assert.equal(detectAdvertisement(null).isAdvertisement, false);
});

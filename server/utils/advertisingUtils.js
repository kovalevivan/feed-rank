const EXPLICIT_AD_PATTERNS = [
  /(?:^|\n)\s*#(?:реклама|advertisement|sponsored|ad)(?![\p{L}\p{N}_])/iu,
  /(?:^|\n)\s*реклама\s*(?:(?:[|•—:-])|(?=\n|$))/iu,
  /(?:^|\n)\s*(?:на\s+правах\s+рекламы|партн[её]рск(?:ий|ая|ое)\s+(?:материал|публикация))(?!\p{L})/iu,
  /(?<![\p{L}\p{N}_])erid\s*[:=]?\s*[a-z0-9][a-z0-9._-]{4,}(?![a-z0-9._-])/iu,
  /(?<!\p{L})рекламодатель\s*[:—-]\s*\S/iu,
  /(?:^|\n)\s*(?:advertisement|sponsored\s+post)\s*(?:[:|—-]|$)/iu
];

const PROMO_CODE_PATTERN =
  /(?<!\p{L})[Пп]ромокод\s*[:—-]?\s*[A-ZА-ЯЁ0-9][A-ZА-ЯЁ0-9_-]{2,}(?![\p{L}\p{N}_-])/u;
const COMMERCIAL_OFFER_PATTERN =
  /(?<!\p{L})(?:скидк\p{L}*|распродаж\p{L}*|акци\p{L}*|кэшбэк\p{L}*|рассрочк\p{L}*|промокод\p{L}*|спецпредложени\p{L}*)(?!\p{L})/iu;
const COMMERCIAL_ACTION_PATTERN =
  /(?<!\p{L})(?:куп(?:и|ить|ите)|закаж(?:и|ите)|оформ(?:и|ите|ить)|переход(?:и|ите)|регистрируй(?:ся|тесь)|забронируй(?:те)?|успей(?:те)?|остав(?:ь|ьте)\s+заявку)(?!\p{L})/iu;

/**
 * Detects high-confidence advertising copy without treating a channel's
 * ordinary "по вопросам рекламы" footer as an advertisement.
 */
const detectAdvertisement = (text) => {
  if (typeof text !== 'string' || !text.trim()) {
    return { isAdvertisement: false, reason: null };
  }

  const normalized = text.replace(/\r\n?/gu, '\n').trim();

  if (EXPLICIT_AD_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { isAdvertisement: true, reason: 'explicit_label' };
  }

  if (PROMO_CODE_PATTERN.test(normalized)) {
    return { isAdvertisement: true, reason: 'promo_code' };
  }

  if (
    COMMERCIAL_OFFER_PATTERN.test(normalized) &&
    COMMERCIAL_ACTION_PATTERN.test(normalized)
  ) {
    return { isAdvertisement: true, reason: 'commercial_offer' };
  }

  return { isAdvertisement: false, reason: null };
};

module.exports = {
  detectAdvertisement
};

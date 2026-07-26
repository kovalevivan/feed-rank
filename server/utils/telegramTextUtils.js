const FOOTER_CTA_PATTERN = new RegExp(
  `(?<!\\p{L})(?:${[
    'подпис(?:аться|ывай(?:тесь)?|ываемся)',
    'подпиш(?:ись|итесь)',
    'читайте\\s+нас',
    '(?:мы|новости)\\s+в\\s+(?:telegram|телеграм|макс|max|вк|vk)',
    'наш(?:и|ем|его)?\\s+(?:канал|телеграм|telegram|макс|max)',
    '(?:прислать|предложить|сообщить)\\s+(?:нам\\s+)?(?:новость|материал)',
    '(?:присылайте|предлагайте)\\s+(?:нам\\s+)?(?:новости|материалы)',
    'обратная\\s+связь',
    '(?:связаться\\s+с\\s+редакцией|контакты\\s+редакции)',
    'всегда\\s+на\\s+связи',
    '(?:по\\s+вопросам\\s+)?реклам(?:а|ы|е|у|ой)',
    'сотрудничеств(?:о|а|у|ом|е)',
    'поддержать\\s+(?:нас|канал|проект)',
    'бот\\s+(?:редакции|обратной\\s+связи)',
    'follow\\s+us',
    'subscribe',
    'send\\s+us\\s+(?:a\\s+)?(?:tip|story|news)'
  ].join('|')})(?!\\p{L})`,
  'iu'
);

const TELEGRAM_LINK_PATTERN = /(?:https?:\/\/)?(?:t(?:elegram)?\.me|telegram\.dog)\/[a-z0-9_+/-]+/iu;
const TELEGRAM_HANDLE_PATTERN = /(^|[\s|•·—–:()[\]{}])@[a-z0-9_]{4,}(?=$|[\s|•·—–:()[\]{}])/iu;
const DECORATION_ONLY_PATTERN = /^[\s|•·—–_=*~.▪▫◾◽🔹🔸]+$/u;
const PROMO_LABEL_PATTERN = /^(?:наш(?:и)?\s+)?(?:telegram|телеграм|tg|тг|макс|max|канал)(?:\s+канал)?$/iu;

const isShortPromoBlock = (block) => {
  const compact = block.replace(/\s+/gu, ' ').trim();
  if (!compact || compact.length > 180) {
    return false;
  }

  const hasTelegramReference =
    TELEGRAM_LINK_PATTERN.test(compact) || TELEGRAM_HANDLE_PATTERN.test(compact);
  if (!hasTelegramReference) {
    return false;
  }

  const withoutReferences = compact
    .replace(new RegExp(TELEGRAM_LINK_PATTERN.source, 'giu'), '')
    .replace(/(^|[\s|•·—–:()[\]{}])@[a-z0-9_]{4,}(?=$|[\s|•·—–:()[\]{}])/giu, '$1')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  // A standalone link or an explicit channel label is a footer. Arbitrary
  // short phrases such as "Источник: t.me/..." remain part of the news.
  return !withoutReferences || PROMO_LABEL_PATTERN.test(withoutReferences);
};

/**
 * Removes a trailing Telegram channel promo/contact block from a post.
 *
 * The function deliberately works only at the end of the text and requires
 * either an explicit call to action or a compact standalone Telegram link.
 * Mentions and links inside the news body are therefore preserved.
 */
const stripTelegramFooter = (text) => {
  if (typeof text !== 'string' || !text.trim()) {
    return text || '';
  }

  const normalized = text.replace(/\r\n?/gu, '\n').trimEnd();
  const paragraphs = normalized.split(/\n[ \t]*\n+/u);
  let footerStart = paragraphs.length;

  for (let index = paragraphs.length - 1; index >= 1; index -= 1) {
    const paragraph = paragraphs[index].trim();
    const isFooter = FOOTER_CTA_PATTERN.test(paragraph) ||
      isShortPromoBlock(paragraph) ||
      DECORATION_ONLY_PATTERN.test(paragraph);

    if (!isFooter) {
      break;
    }
    footerStart = index;
  }

  if (footerStart < paragraphs.length) {
    return paragraphs.slice(0, footerStart).join('\n\n').trimEnd();
  }

  // Some channels put the footer on the next line without an empty separator.
  const lines = normalized.split('\n');
  const firstCandidate = Math.max(1, lines.length - 8);
  for (let index = firstCandidate; index < lines.length; index += 1) {
    const tail = lines.slice(index).join('\n').trim();
    if (FOOTER_CTA_PATTERN.test(lines[index]) &&
        (isShortPromoBlock(tail) || tail.length <= 240)) {
      return lines.slice(0, index).join('\n').trimEnd();
    }
  }

  return normalized;
};

module.exports = {
  stripTelegramFooter
};

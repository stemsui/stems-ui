/**
 * Locale-aware text matching shared by the combobox / autocomplete filter and the filterable
 * menu: Base UI's `useFilter()` `contains` / `startsWith`, ignoring case and diacritics.
 */

const collators = new Map<string, Intl.Collator>()

function getCollator(locale: Intl.LocalesArgument): Intl.Collator {
  let key = locale === undefined ? '' : String(locale)
  let collator = collators.get(key)
  if (!collator) {
    collator = new Intl.Collator(locale as string | string[] | undefined, {
      usage: 'search',
      sensitivity: 'base',
    })
    collators.set(key, collator)
  }
  return collator
}

/**
 * Whether `text` contains `query`, ignoring case and diacritics (Base UI `useFilter().contains`).
 */
export function containsText(text: string, query: string, locale?: Intl.LocalesArgument): boolean {
  if (query === '') return true
  let collator = getCollator(locale)
  let normalizedText = text.normalize('NFC')
  let normalizedQuery = query.normalize('NFC')
  let length = normalizedQuery.length
  for (let index = 0; index + length <= normalizedText.length; index++) {
    if (collator.compare(normalizedText.slice(index, index + length), normalizedQuery) === 0) {
      return true
    }
  }
  return false
}

/** Whether `text` starts with `query`, ignoring case and diacritics. */
export function startsWithText(
  text: string,
  query: string,
  locale?: Intl.LocalesArgument,
): boolean {
  if (query === '') return true
  let slice = text.normalize('NFC').slice(0, query.normalize('NFC').length)
  return getCollator(locale).compare(slice, query.normalize('NFC')) === 0
}

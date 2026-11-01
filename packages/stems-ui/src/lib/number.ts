/**
 * Number helpers shared by `stems-ui/slider` and `stems-ui/number-field`: clamping, step
 * snapping without floating-point noise, and locale-aware formatting and parsing.
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Number of decimal places in `value` (handles exponent notation such as `1e-7`). */
export function getPrecision(value: number): number {
  if (!Number.isFinite(value)) return 0
  let text = String(value)
  let exponent = text.match(/e([+-]\d+)$/i)
  if (exponent) {
    let [mantissa] = text.split(/e/i)
    let decimals = mantissa.split('.')[1]?.length ?? 0
    return Math.max(0, decimals - Number(exponent[1]))
  }
  return text.split('.')[1]?.length ?? 0
}

/** Rounds `value` to `precision` decimal places, removing floating-point noise. */
export function roundToPrecision(value: number, precision: number): number {
  if (!Number.isFinite(value)) return value
  return Number(value.toFixed(Math.min(100, Math.max(0, precision))))
}

/**
 * Snaps `value` to the nearest multiple of `step` counted from `origin`. The result keeps the
 * larger precision of the inputs, so `0.1 + 0.2` snaps to `0.3`.
 */
export function roundToStep(value: number, step: number, origin = 0): number {
  if (!(step > 0)) return value
  let precision = Math.max(getPrecision(step), getPrecision(origin))
  let snapped = origin + Math.round((value - origin) / step) * step
  return roundToPrecision(snapped, precision)
}

/** Adds two numbers, keeping the larger decimal precision of the inputs. */
export function addWithPrecision(a: number, b: number): number {
  return roundToPrecision(a + b, Math.max(getPrecision(a), getPrecision(b)))
}

export interface NumberFormatOptions {
  format?: Intl.NumberFormatOptions
  locale?: Intl.LocalesArgument
}

let formatterCache = new Map<string, Intl.NumberFormat>()

/** A cached `Intl.NumberFormat` for the locale and options. */
export function getFormatter(
  locale?: Intl.LocalesArgument,
  format?: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  let key = JSON.stringify([locale ?? null, format ?? null])
  let formatter = formatterCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, format)
    if (formatterCache.size > 100) formatterCache.clear()
    formatterCache.set(key, formatter)
  }
  return formatter
}

/** Formats a number with `Intl.NumberFormat`; `''` for `null` or non-finite values. */
export function formatNumber(value: number | null, options: NumberFormatOptions = {}): string {
  if (value === null || !Number.isFinite(value)) return ''
  return getFormatter(options.locale, options.format).format(value)
}

const MINUS = '-−‒–—﹣－'
const IS_MINUS = new RegExp(`[${MINUS}]`)
const IS_PLUS = /[+＋]/
// Spaces used as group separators by some locales (fr: narrow no-break space).
const SPACES = /[\s   ]/g

export interface NumberSymbols {
  decimal: string
  group: string
  /** Locale digits 0-9, in order. */
  digits: string[]
  /** Literal strings the formatter adds around numbers (currency, percent, units). */
  affixes: string[]
}

let symbolsCache = new Map<string, NumberSymbols>()

/** The decimal and group separators, digits, and affixes the formatter uses. */
export function getNumberSymbols(options: NumberFormatOptions = {}): NumberSymbols {
  let key = JSON.stringify([options.locale ?? null, options.format ?? null])
  let cached = symbolsCache.get(key)
  if (cached) return cached

  let plain = getFormatter(options.locale, { useGrouping: true })
  let parts = plain.formatToParts(-12345.6)
  let decimal = parts.find((part) => part.type === 'decimal')?.value ?? '.'
  let group = parts.find((part) => part.type === 'group')?.value ?? ','
  let digitFormatter = getFormatter(options.locale, { useGrouping: false })
  let digits = Array.from({ length: 10 }, (_, digit) => digitFormatter.format(digit))

  let affixes = new Set<string>()
  if (options.format) {
    let formatter = getFormatter(options.locale, options.format)
    for (let sample of [-1234.5, 1234.5]) {
      for (let part of formatter.formatToParts(sample)) {
        if (
          part.type === 'currency' ||
          part.type === 'percentSign' ||
          part.type === 'unit' ||
          part.type === 'literal' ||
          part.type === 'compact' ||
          part.type === 'exponentSeparator'
        ) {
          let text = part.value.trim()
          if (text) affixes.add(text)
        }
      }
    }
  }

  let symbols: NumberSymbols = { decimal, group, digits, affixes: [...affixes] }
  if (symbolsCache.size > 100) symbolsCache.clear()
  symbolsCache.set(key, symbols)
  return symbols
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Parses text typed or pasted into a number field, honoring the locale's digits and separators
 * and the format's affixes (currency, `%`, units). Returns `null` for empty text and `NaN` for
 * text that isn't a number. Percent formats divide by 100, like `Intl.NumberFormat` multiplies.
 */
export function parseNumber(text: string, options: NumberFormatOptions = {}): number | null {
  let symbols = getNumberSymbols(options)
  // Bidi marks (Arabic formats start with U+061C) carry no value.
  let input = text.replace(/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '').trim()
  if (input === '') return null

  let percent = options.format?.style === 'percent' || /[%٪]/.test(input)
  for (let affix of [...symbols.affixes].sort((a, b) => b.length - a.length)) {
    if (/^[\p{L}\p{Sc}%٪]/u.test(affix) || affix.length > 1) {
      input = input.replace(new RegExp(escapeRegExp(affix), 'gu'), '')
    }
  }
  input = input.replace(/[%٪‰]/g, '').replace(/\p{Sc}/gu, '')

  // Locale digits → ASCII.
  symbols.digits.forEach((digit, index) => {
    if (digit !== String(index)) input = input.split(digit).join(String(index))
  })

  input = input.trim()
  // A sign is only valid in front (`-5`, `-€5` after affix removal) or as accounting parentheses.
  let negative = false
  if (/^\(.*\)$/.test(input)) {
    negative = true
    input = input.slice(1, -1).trim()
  } else if (IS_MINUS.test(input.charAt(0))) {
    negative = true
    input = input.slice(1)
  } else if (IS_PLUS.test(input.charAt(0))) {
    input = input.slice(1)
  }
  if (IS_MINUS.test(input) || IS_PLUS.test(input) || /[()]/.test(input)) return Number.NaN

  let group = symbols.group
  let decimal = symbols.decimal
  input = input.replace(SPACES, '')
  if (group.trim() !== '') input = input.split(group).join('')
  // Accept `.` as the decimal separator when the locale doesn't use it for grouping.
  if (decimal !== '.' && group !== '.') input = input.split('.').join(decimal)
  if (decimal !== '.') input = input.split(decimal).join('.')

  if (!/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(input)) return Number.NaN
  let value = Number(input)
  if (!Number.isFinite(value)) return Number.NaN
  if (negative) value = -value
  if (percent) value = roundToPrecision(value / 100, getPrecision(value) + 2)
  return value
}

/**
 * Whether `char` can appear in a number typed for this locale and format: digits, separators,
 * signs, exponent markers, and the format's affix characters.
 */
export function isAllowedNumberChar(char: string, options: NumberFormatOptions = {}): boolean {
  if (/^[0-9]$/.test(char)) return true
  let symbols = getNumberSymbols(options)
  if (symbols.digits.includes(char)) return true
  if (char === symbols.decimal || char === symbols.group || char === '.' || char === ',') {
    return true
  }
  if (IS_MINUS.test(char) || IS_PLUS.test(char)) return true
  if (char === ' ' || char === ' ' || char === ' ') return true
  if (char === '%' || char === 'e' || char === 'E' || char === '(' || char === ')') return true
  if (/\p{Sc}/u.test(char)) return true
  return symbols.affixes.some((affix) => affix.includes(char))
}

import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  addWithPrecision,
  formatNumber,
  getPrecision,
  isAllowedNumberChar,
  parseNumber,
  roundToStep,
} from './number.ts'

describe('lib/number', () => {
  it('measures precision, including exponent notation', () => {
    expect(getPrecision(1)).toBe(0)
    expect(getPrecision(0.25)).toBe(2)
    expect(getPrecision(1e-7)).toBe(7)
    expect(getPrecision(1.5e-3)).toBe(4)
  })

  it('snaps to steps without floating-point noise', () => {
    expect(roundToStep(0.30000000000000004, 0.1)).toBe(0.3)
    expect(roundToStep(7, 5, 1)).toBe(6)
    expect(roundToStep(8.6, 5, 1)).toBe(11)
    expect(addWithPrecision(0.1, 0.2)).toBe(0.3)
  })

  it('formats with Intl', () => {
    expect(formatNumber(1234.5, { locale: 'en-US' })).toBe('1,234.5')
    expect(formatNumber(null)).toBe('')
    expect(formatNumber(0.5, { locale: 'en-US', format: { style: 'percent' } })).toBe('50%')
  })

  it('parses en-US numbers', () => {
    let options = { locale: 'en-US' }
    expect(parseNumber('', options)).toBe(null)
    expect(parseNumber('  ', options)).toBe(null)
    expect(parseNumber('1,234.5', options)).toBe(1234.5)
    expect(parseNumber('-12', options)).toBe(-12)
    expect(parseNumber('−12', options)).toBe(-12)
    expect(parseNumber('+3', options)).toBe(3)
    expect(parseNumber('(4)', options)).toBe(-4)
    expect(parseNumber('.5', options)).toBe(0.5)
    expect(parseNumber('1e3', options)).toBe(1000)
    expect(Number.isNaN(parseNumber('12-', options))).toBe(true)
    expect(Number.isNaN(parseNumber('1-2', options))).toBe(true)
    expect(Number.isNaN(parseNumber('abc', options))).toBe(true)
    expect(Number.isNaN(parseNumber('1.2.3', options))).toBe(true)
  })

  it('parses locale separators, digits, and affixes', () => {
    expect(parseNumber('1.234,5', { locale: 'de-DE' })).toBe(1234.5)
    expect(parseNumber('1 234,5', { locale: 'fr-FR' })).toBe(1234.5)
    expect(parseNumber('1 234,5', { locale: 'fr-FR' })).toBe(1234.5)
    expect(parseNumber('٤٢', { locale: 'ar-EG' })).toBe(42)
    expect(parseNumber('50%', { locale: 'en-US', format: { style: 'percent' } })).toBe(0.5)
    expect(parseNumber('50', { locale: 'en-US', format: { style: 'percent' } })).toBe(0.5)
    expect(
      parseNumber('-€1,234.50', {
        locale: 'en-US',
        format: { style: 'currency', currency: 'EUR' },
      }),
    ).toBe(-1234.5)
    expect(
      parseNumber('12 km', {
        locale: 'en-US',
        format: { style: 'unit', unit: 'kilometer' },
      }),
    ).toBe(12)
  })

  it('round-trips formatted values', () => {
    for (let locale of ['en-US', 'de-DE', 'fr-FR', 'hi-IN', 'ar-EG']) {
      let text = formatNumber(-98765.25, { locale })
      expect(parseNumber(text, { locale })).toBe(-98765.25)
    }
  })

  it('lists characters allowed while typing', () => {
    expect(isAllowedNumberChar('5')).toBe(true)
    expect(isAllowedNumberChar('-')).toBe(true)
    expect(isAllowedNumberChar(',', { locale: 'de-DE' })).toBe(true)
    expect(isAllowedNumberChar('٣', { locale: 'ar-EG' })).toBe(true)
    expect(isAllowedNumberChar('€', { format: { style: 'currency', currency: 'EUR' } })).toBe(true)
    expect(isAllowedNumberChar('a')).toBe(false)
    expect(isAllowedNumberChar('z')).toBe(false)
  })
})

import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'

import { normalizeOTPValue } from './otp.ts'

describe('lib/otp', () => {
  it('filters by validation type and clamps to length', () => {
    expect(normalizeOTPValue('12 34', 'numeric', 6)).toEqual({ value: '1234', rejected: false })
    expect(normalizeOTPValue('1a2', 'numeric', 6)).toEqual({ value: '12', rejected: true })
    expect(normalizeOTPValue('ab1', 'alpha', 6)).toEqual({ value: 'ab', rejected: true })
    expect(normalizeOTPValue('ab1-', 'alphanumeric', 6)).toEqual({ value: 'ab1', rejected: true })
    expect(normalizeOTPValue('a-1', 'none', 6)).toEqual({ value: 'a-1', rejected: false })
    expect(normalizeOTPValue('1234567', 'numeric', 6).value).toBe('123456')
  })

  it('applies normalizeValue and filters its result again', () => {
    let upper = (value: string) => value.toUpperCase()
    expect(normalizeOTPValue('ab12', 'alphanumeric', 6, upper).value).toBe('AB12')
    let addDash = (value: string) => `${value}-`
    expect(normalizeOTPValue('12', 'numeric', 6, addDash)).toEqual({ value: '12', rejected: true })
  })
})

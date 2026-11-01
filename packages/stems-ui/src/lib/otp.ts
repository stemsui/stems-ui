/** Character filtering for `stems-ui/otp-field`, following Base UI's `validationType`. */

export type OTPValidationType = 'numeric' | 'alpha' | 'alphanumeric' | 'none'

const ACCEPTS: Record<OTPValidationType, RegExp> = {
  numeric: /^[0-9]$/,
  alpha: /^[A-Za-z]$/,
  alphanumeric: /^[A-Za-z0-9]$/,
  none: /^\S$/u,
}

function filter(text: string, type: OTPValidationType) {
  let accepted = ''
  let rejected = false
  for (let char of text) {
    if (/\s/.test(char)) continue
    if (ACCEPTS[type].test(char)) accepted += char
    else rejected = true
  }
  return { accepted, rejected }
}

/**
 * Normalizes an OTP value: drops whitespace, filters by `validationType`, applies
 * `normalizeValue` and filters again, then clamps to `length`. `rejected` reports whether any
 * non-whitespace character was dropped.
 */
export function normalizeOTPValue(
  text: string,
  validationType: OTPValidationType,
  length: number,
  normalizeValue?: (value: string) => string,
): { value: string; rejected: boolean } {
  let first = filter(text, validationType)
  let value = first.accepted
  let rejected = first.rejected
  if (normalizeValue) {
    let second = filter(normalizeValue(value), validationType)
    value = second.accepted
    rejected ||= second.rejected
  }
  return { value: [...value].slice(0, Math.max(0, length)).join(''), rejected }
}

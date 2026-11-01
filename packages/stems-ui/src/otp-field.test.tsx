import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as otpField from './otp-field.ts'

describe('otp-field (server render)', () => {
  it('renders slot values, state attributes, and the hidden input', async () => {
    let html = await renderToString(
      <otpField.Context length={3} defaultValue="12" id="code" name="otp" required mask>
        <div mix={otpField.root()}>
          <input mix={otpField.input()} />
          <input mix={otpField.input()} />
          <div mix={otpField.separator()} />
          <input mix={otpField.input()} />
        </div>
      </otpField.Context>,
    )

    let root = html.match(/<div[^>]*role="group"[^>]*>/)![0]
    expect(root).toContain('data-filled=""')
    expect(root).toContain('data-required=""')
    expect(root).not.toContain('data-complete')
    expect(root).not.toContain('data-focused')

    let slots = html.match(/<input[^>]*inputmode[^>]*>/g)!
    expect(slots.length).toBe(3)
    expect(slots[0]).toContain('id="code"')
    expect(slots[0]).toContain('value="1"')
    expect(slots[0]).toContain('type="password"')
    expect(slots[0]).toContain('autocomplete="one-time-code"')
    expect(slots[0]).toContain('tabindex="-1"')
    expect(slots[0]).toContain('data-filled=""')
    expect(slots[1]).toContain('id="code-2"')
    expect(slots[1]).toContain('autocomplete="off"')
    expect(slots[2]).toContain('id="code-3"')
    expect(slots[2]).toContain('tabindex="0"')
    expect(slots[2]).not.toContain('data-filled')

    expect(html).toContain('role="separator"')
    expect(html).toContain('aria-orientation="horizontal"')

    let hidden = html.match(/<input[^>]*aria-hidden="true"[^>]*>/)![0]
    expect(hidden).toContain('name="otp"')
    expect(hidden).toContain('value="12"')
    expect(hidden).toMatch(/\srequired/)
  })

  it('normalizes the default value and marks a complete field', async () => {
    let html = await renderToString(
      <otpField.Context length={2} defaultValue=" 1a234">
        <div mix={otpField.root()}>
          <input mix={otpField.input()} />
          <input mix={otpField.input()} />
        </div>
      </otpField.Context>,
    )
    expect(html.match(/<div[^>]*>/)![0]).toContain('data-complete=""')
    let slots = html.match(/<input[^>]*inputmode[^>]*>/g)!
    expect(slots[0]).toContain('value="1"')
    expect(slots[1]).toContain('value="2"')
  })
})

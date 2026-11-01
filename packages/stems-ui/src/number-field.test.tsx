import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as numberField from './number-field.ts'

function renderField(props: numberField.NumberFieldContextProps) {
  return renderToString(
    <numberField.Context {...props}>
      <div mix={numberField.root()}>
        <span mix={numberField.scrubArea()}>
          <span mix={numberField.scrubAreaCursor()} />
        </span>
        <div mix={numberField.group()}>
          <button mix={numberField.decrement()} />
          <input aria-label="Amount" mix={numberField.input()} />
          <button mix={numberField.increment()} />
        </div>
      </div>
    </numberField.Context>,
  )
}

describe('number-field (server render)', () => {
  it('renders the formatted value, stepper state, and hidden input', async () => {
    let html = await renderField({
      defaultValue: 1234.5,
      min: 0,
      max: 1234.5,
      name: 'amount',
      locale: 'en-US',
      id: 'amount',
    })

    let input = html.match(/<input[^>]*aria-label="Amount"[^>]*>/)![0]
    expect(input).toContain('id="amount"')
    expect(input).toContain('type="text"')
    expect(input).toContain('value="1,234.5"')
    expect(input).toContain('inputmode="decimal"')
    expect(input).toContain('aria-roledescription="Number field"')

    let [dec, inc] = html.match(/<button[^>]*>/g)!
    expect(dec).toContain('aria-label="Decrease"')
    expect(dec).not.toMatch(/\sdisabled/)
    expect(inc).toContain('aria-label="Increase"')
    expect(inc).toMatch(/\sdisabled/)
    expect(inc).toContain('data-disabled=""')
    expect(inc).toContain('aria-controls="amount"')
    expect(inc).toContain('tabindex="-1"')

    let hidden = html.match(/<input[^>]*type="number"[^>]*>/)![0]
    expect(hidden).toContain('name="amount"')
    expect(hidden).toContain('value="1234.5"')
    expect(hidden).toContain('min="0"')
    expect(hidden).toContain('step="1"')
    expect(hidden).toContain('aria-hidden="true"')

    expect(html).toContain('role="group"')
    let cursor = html.match(/<span[^>]*aria-hidden="true"[^>]*>/)![0]
    expect(cursor).toMatch(/\shidden/)
  })

  it('renders disabled, read-only, and required state attributes', async () => {
    let html = await renderField({ disabled: true, readOnly: true, required: true })
    let root = html.match(/<div[^>]*>/)![0]
    expect(root).toContain('data-disabled=""')
    expect(root).toContain('data-readonly=""')
    expect(root).toContain('data-required=""')
    expect(root).not.toContain('data-scrubbing')
    let input = html.match(/<input[^>]*aria-label="Amount"[^>]*>/)![0]
    expect(input).toMatch(/\sdisabled/)
    expect(input).toMatch(/\sreadonly/)
    expect(input).toContain('value=""')
    expect(input).toContain('inputmode="text"')
  })
})

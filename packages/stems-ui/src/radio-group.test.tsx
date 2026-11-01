import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as radio from './radio.ts'
import * as radioGroup from './radio-group.ts'

function getTag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  expect(match).not.toBe(null)
  return match![0]
}

function getTags(html: string, pattern: RegExp) {
  return [...html.matchAll(new RegExp(pattern, 'g'))].map((match) => match[0])
}

describe('radio-group (server render)', () => {
  it('renders the selected radio, the roving tab stop, and hidden radios', async () => {
    let html = await renderToString(
      <radioGroup.Context
        defaultValue="hdd"
        name="storage"
        form="f"
        required
        orientation="vertical"
      >
        <div aria-label="Storage" mix={radioGroup.root()}>
          {['ssd', 'hdd'].map((value) => (
            <radio.Context value={value}>
              <span data-name={value} aria-label={value} mix={radio.root()}>
                <span data-part={`${value}-indicator`} mix={radio.indicator()} />
              </span>
            </radio.Context>
          ))}
        </div>
      </radioGroup.Context>,
    )

    let group = getTag(html, /<div[^>]*role="radiogroup"[^>]*>/)
    expect(group).toContain('aria-required="true"')
    expect(group).toContain('aria-orientation="vertical"')

    let ssd = getTag(html, /<span[^>]*data-name="ssd"[^>]*>/)
    let hdd = getTag(html, /<span[^>]*data-name="hdd"[^>]*>/)
    expect(ssd).toContain('role="radio"')
    expect(ssd).toContain('aria-checked="false"')
    expect(ssd).toContain('data-unchecked=""')
    expect(ssd).toContain('tabindex="-1"')
    expect(ssd).toContain('data-required=""')
    expect(hdd).toContain('aria-checked="true"')
    expect(hdd).toContain('data-checked=""')
    expect(hdd).toContain('tabindex="0"')

    expect(getTag(html, /<span[^>]*data-part="ssd-indicator"[^>]*>/)).toMatch(/\shidden/)
    expect(getTag(html, /<span[^>]*data-part="hdd-indicator"[^>]*>/)).not.toMatch(/\shidden/)

    let inputs = getTags(html, /<input[^>]*type="radio"[^>]*>/)
    expect(inputs.length).toBe(2)
    expect(inputs[0]).toContain('name="storage"')
    expect(inputs[0]).toContain('value="ssd"')
    expect(inputs[0]).toContain('form="f"')
    expect(inputs[0]).toMatch(/\srequired/)
    expect(inputs[0]).not.toMatch(/\schecked/)
    expect(inputs[1]).toMatch(/\schecked/)
  })

  it('renders disabled and read-only state', async () => {
    let html = await renderToString(
      <radioGroup.Context disabled readOnly>
        <div aria-label="Storage" mix={radioGroup.root()}>
          <radio.Context value="ssd">
            <button aria-label="SSD" mix={radio.root()} />
          </radio.Context>
        </div>
      </radioGroup.Context>,
    )

    let group = getTag(html, /<div[^>]*role="radiogroup"[^>]*>/)
    expect(group).toContain('data-disabled=""')
    expect(group).toContain('aria-disabled="true"')
    expect(group).toContain('aria-readonly="true"')

    let button = getTag(html, /<button[^>]*>/)
    expect(button).toContain('type="button"')
    expect(button).toMatch(/\sdisabled/)
    expect(button).toContain('data-disabled=""')
    expect(button).toContain('data-readonly=""')
    expect(button).not.toContain('tabindex')
    expect(getTag(html, /<input[^>]*type="radio"[^>]*>/)).toMatch(/\sdisabled/)
  })
})

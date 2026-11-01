import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle } from 'remix/component'
import { renderToString } from 'remix/component/server'

import * as field from '../field.ts'
import { connectFieldControl } from './field-control.ts'

function Probe(handle: Handle<{ value?: string }>) {
  let fieldControl = connectFieldControl(handle)
  return () => {
    let f = fieldControl.render({ value: handle.props.value })
    return <span id={f.id} aria-invalid={f.invalid ? 'true' : undefined} {...f.dataAttrs} />
  }
}

describe('field-control (server)', () => {
  it('renders nothing outside a field', async () => {
    let html = await renderToString(<Probe value="x" />)
    assert.equal(html, '<span></span>')
  })

  it('renders the field state and control id inside a field', async () => {
    let html = await renderToString(
      <field.Context invalid>
        <label mix={field.label()}>Label</label>
        <Probe value="x" />
      </field.Context>,
    )
    let id = html.match(/for="([^"]+)"/)?.[1]
    assert.ok(id)
    assert.match(
      html,
      new RegExp(`<span id="${id}" aria-invalid="true" data-invalid="" data-filled="">`),
    )
  })
})

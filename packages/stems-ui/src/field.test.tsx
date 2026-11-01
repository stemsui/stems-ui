import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as field from './field.ts'
import * as fieldset from './fieldset.ts'
import * as form from './form.ts'
import * as checkbox from './checkbox.ts'
import * as checkboxGroup from './checkbox-group.ts'
import * as radio from './radio.ts'
import * as radioGroup from './radio-group.ts'
import * as select from './select.tsx'
import * as switch_ from './switch.ts'

function attr(html: string, selector: RegExp) {
  return html.match(selector)?.[1]
}

describe('field (server)', () => {
  it('renders label, control and preceding description ids', async () => {
    let html = await renderToString(
      <field.Context name="email">
        <div mix={field.root()}>
          <label mix={field.label()}>Email</label>
          <p mix={field.description()}>We never share it</p>
          <input type="email" mix={field.control({ defaultValue: 'ada@example.com' })} />
        </div>
      </field.Context>,
    )
    let labelFor = attr(html, /<label[^>]*\sfor="([^"]+)"/)
    let controlId = attr(html, /<input[^>]*\sid="([^"]+)"/)
    let descriptionId = attr(html, /<p[^>]*\sid="([^"]+)"/)
    assert.ok(controlId)
    assert.equal(labelFor, controlId)
    assert.equal(attr(html, /<input[^>]*aria-describedby="([^"]+)"/), descriptionId)
    assert.match(html, /<input[^>]*name="email"/)
    assert.match(html, /<input[^>]*data-filled=""/)
    assert.doesNotMatch(html, /data-(valid|invalid|dirty|touched|focused)/)
    assert.doesNotMatch(html, /aria-invalid/)
  })

  it('renders hidden errors until the field is validated', async () => {
    let html = await renderToString(
      <field.Context>
        <input required mix={field.control()} />
        <div mix={field.error()}>Required</div>
      </field.Context>,
    )
    assert.match(html, /<div[^>]*\shidden(\s|>|=)/)
  })

  it('renders the invalid and disabled states', async () => {
    let html = await renderToString(
      <field.Context invalid disabled>
        <div id="root" mix={field.root()}>
          <div id="error" mix={field.error()}>
            Invalid
          </div>
          <input mix={field.control()} />
        </div>
      </field.Context>,
    )
    assert.match(html, /<div id="root"[^>]*data-invalid=""/)
    assert.match(html, /<div id="root"[^>]*data-disabled=""/)
    assert.match(html, /<input[^>]*aria-invalid="true"/)
    assert.match(html, /<input[^>]*aria-describedby="error"/)
    assert.match(html, /<input[^>]*\sdisabled(\s|>|=|\/)/)
    assert.doesNotMatch(html, /<div id="error"[^>]*hidden/)
  })

  it('renders server errors from form.Context, for JavaScript-free submissions', async () => {
    let html = await renderToString(
      <form.Context errors={{ username: 'Username is taken' }}>
        <form mix={form.root()}>
          <field.Context name="username">
            <input mix={field.control({ defaultValue: 'admin' })} />
            <div id="error" mix={field.error()}>
              <field.Validity>{(state) => state.error}</field.Validity>
            </div>
          </field.Context>
        </form>
      </form.Context>,
    )
    assert.doesNotMatch(html, /novalidate/i, 'native validation stays on without JavaScript')
    assert.match(html, /<input[^>]*aria-invalid="true"/)
    assert.match(html, /<input[^>]*data-invalid=""/)
    assert.match(html, /<div id="error"[^>]*>Username is taken<\/div>/)
    assert.doesNotMatch(html, /<div id="error"[^>]*hidden/)
  })

  it('renders fieldset disabled state into fields', async () => {
    let html = await renderToString(
      <fieldset.Context disabled>
        <fieldset mix={fieldset.root()}>
          <legend mix={fieldset.legend()}>Billing</legend>
          <field.Context>
            <input mix={field.control()} />
          </field.Context>
        </fieldset>
      </fieldset.Context>,
    )
    assert.match(html, /<fieldset[^>]*\sdisabled/)
    assert.match(html, /<legend[^>]*data-disabled=""/)
    assert.match(html, /<input[^>]*data-disabled=""/)
  })

  it('renders Validity with the initial state', async () => {
    let html = await renderToString(
      <field.Context>
        <field.Validity>{(state) => `valid:${String(state.validity.valid)}`}</field.Validity>
      </field.Context>,
    )
    assert.match(html, /valid:null/)
  })
})

function tag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  assert.ok(match, `no match for ${pattern}`)
  return match[0]
}

describe('field integration (server)', () => {
  it('labels a switch, names its hidden input and renders server errors', async () => {
    let html = await renderToString(
      <form.Context errors={{ alerts: 'Nope' }}>
        <field.Context name="alerts">
          <label mix={field.label()}>Alerts</label>
          <switch_.Context defaultChecked>
            <span mix={switch_.root()}>
              <span mix={switch_.thumb()} />
            </span>
          </switch_.Context>
        </field.Context>
      </form.Context>,
    )
    let labelId = attr(html, /<label[^>]*\sid="([^"]+)"/)
    let labelFor = attr(html, /<label[^>]*\sfor="([^"]+)"/)
    let input = tag(html, /<input[^>]*>/)
    assert.match(input, new RegExp(`id="${labelFor}"`))
    assert.match(input, /name="alerts"/)
    let root = tag(html, /<span[^>]*role="switch"[^>]*>/)
    assert.match(root, new RegExp(`aria-labelledby="${labelId}"`))
    assert.match(root, /aria-invalid="true"/)
    assert.match(root, /data-invalid=""/)
    assert.match(root, /data-filled=""/)
    assert.match(tag(html, /<span(?![^>]*role=)[^>]*data-checked[^>]*>/), /data-invalid=""/)
  })

  it('renders fieldset disabled into a checkbox', async () => {
    let html = await renderToString(
      <fieldset.Context disabled>
        <checkbox.Context>
          <span aria-label="Terms" mix={checkbox.root()} />
        </checkbox.Context>
      </fieldset.Context>,
    )
    let root = tag(html, /<span[^>]*role="checkbox"[^>]*>/)
    assert.match(root, /aria-disabled="true"/)
    assert.match(root, /data-disabled=""/)
    assert.match(tag(html, /<input[^>]*>/), /disabled/)
  })

  it('labels checkbox group items through field.ItemContext', async () => {
    let html = await renderToString(
      <field.Context name="protocols" disabled>
        <checkboxGroup.Context defaultValue={['ssh']}>
          <div aria-label="Protocols" mix={checkboxGroup.root()}>
            {['http', 'ssh'].map((value) => (
              <field.ItemContext>
                <div mix={field.item()}>
                  <label mix={field.label()}>{value}</label>
                  <checkbox.Context value={value}>
                    <span mix={checkbox.root()} />
                  </checkbox.Context>
                </div>
              </field.ItemContext>
            ))}
          </div>
        </checkboxGroup.Context>
      </field.Context>,
    )
    let labels = [...html.matchAll(/<label[^>]*\sid="([^"]+)"[^>]*\sfor="([^"]+)"/g)]
    let inputs = [...html.matchAll(/<input[^>]*\sid="([^"]+)"[^>]*>/g)]
    let roots = [...html.matchAll(/<span[^>]*role="checkbox"[^>]*>/g)].map((match) => match[0])
    assert.equal(labels.length, 2)
    assert.equal(inputs.length, 2)
    labels.forEach((label, index) => {
      assert.equal(label[2], inputs[index]![1])
      assert.match(roots[index]!, new RegExp(`aria-labelledby="${label[1]}"`))
      assert.match(roots[index]!, /aria-disabled="true"/)
      assert.match(inputs[index]![0], /name="protocols"/)
    })
    assert.notEqual(inputs[0]![1], inputs[1]![1])
    assert.match(tag(html, /<div[^>]*role="group"[^>]*>/), /data-filled=""/)
    assert.match(html, /<div data-disabled=""/)
  })

  it('labels radios through field.ItemContext and the group through the field', async () => {
    let html = await renderToString(
      <field.Context name="storage">
        <div mix={field.label()}>Storage</div>
        <radioGroup.Context defaultValue="ssd">
          <div mix={radioGroup.root()}>
            <field.ItemContext>
              <label mix={field.label()}>
                <radio.Context value="ssd">
                  <span mix={radio.root()} />
                </radio.Context>
                SSD
              </label>
            </field.ItemContext>
          </div>
        </radioGroup.Context>
      </field.Context>,
    )
    let fieldLabel = attr(html, /<div[^>]*\sid="([^"]+)"[^>]*>Storage/)
    let group = tag(html, /<div[^>]*role="radiogroup"[^>]*>/)
    assert.match(group, new RegExp(`aria-labelledby="${fieldLabel}"`))
    let itemLabel = attr(html, /<label[^>]*\sid="([^"]+)"/)
    let labelFor = attr(html, /<label[^>]*\sfor="([^"]+)"/)
    assert.match(
      tag(html, /<span[^>]*role="radio"[^>]*>/),
      new RegExp(`aria-labelledby="${itemLabel}"`),
    )
    assert.match(
      tag(html, /<input[^>]*>/),
      new RegExp(`id="${labelFor}"[^>]*name="storage"|name="storage"[^>]*id="${labelFor}"`),
    )
  })

  it('points the field label at the select trigger', async () => {
    let html = await renderToString(
      <field.Context name="fruit" invalid>
        <label mix={field.label()}>Fruit</label>
        <select.Context defaultValue="apple">
          <button mix={select.trigger()}>
            <span mix={select.value()}>
              <select.ValueText />
            </span>
          </button>
        </select.Context>
      </field.Context>,
    )
    let labelId = attr(html, /<label[^>]*\sid="([^"]+)"/)
    let labelFor = attr(html, /<label[^>]*\sfor="([^"]+)"/)
    let trigger = tag(html, /<button[^>]*>/)
    assert.match(trigger, new RegExp(`id="${labelFor}"`))
    assert.match(trigger, new RegExp(`aria-labelledby="${labelId}"`))
    assert.match(trigger, /aria-invalid="true"/)
    assert.match(trigger, /data-invalid=""/)
    assert.match(trigger, /data-filled=""/)
    assert.match(tag(html, /<input[^>]*>/), /name="fruit"/)
  })
})

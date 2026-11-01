import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import {
  attrs,
  createMixin,
  on,
  ref,
  type ElementProps,
  type Handle,
  type RemixNode,
} from 'remix/component'
import { render } from 'remix/component/test'

import * as field from '../field.ts'
import * as fieldset from '../fieldset.ts'
import * as form from '../form.ts'
import { connectFieldControl, type FieldControlRenderResult } from './field-control.ts'

/**
 * A custom widget built like other agents' controls: a `<span role="checkbox">` mixin whose
 * value lives in a visually hidden `<input type="checkbox">` rendered by the app.
 */
function Check(handle: Handle<{ name?: string; required?: boolean; id?: string }>) {
  let checked = false
  let hidden: HTMLInputElement | null = null
  let root: HTMLElement | null = null
  let fieldControl = connectFieldControl(handle, {
    getValue: () => checked,
    getValidityElement: () => hidden,
    getFocusElement: () => root,
    isFilled: (value) => value === true,
  })

  return () => {
    let f = fieldControl.render({ value: checked, id: handle.props.id, name: handle.props.name })
    return (
      <span>
        <span
          role="checkbox"
          tabIndex={0}
          aria-checked={checked ? 'true' : 'false'}
          aria-labelledby={f.labelId}
          aria-describedby={f.describedBy}
          aria-invalid={f.invalid ? 'true' : undefined}
          aria-disabled={f.disabled ? 'true' : undefined}
          id={f.id}
          {...f.dataAttrs}
          mix={[
            ref((node: HTMLElement) => (root = node)),
            on('focus', () => fieldControl.focus()),
            on('blur', () => fieldControl.blur()),
            on('click', (event) => {
              if (f.disabled) return
              checked = !checked
              if (hidden) hidden.checked = checked
              fieldControl.change(checked, event)
              void handle.update()
            }),
          ]}
        />
        <input
          type="checkbox"
          aria-hidden="true"
          tabIndex={-1}
          style={{ position: 'absolute', opacity: '0', pointerEvents: 'none' }}
          name={f.name}
          required={handle.props.required}
          disabled={f.disabled || undefined}
          mix={ref((node: HTMLInputElement) => (hidden = node))}
        />
      </span>
    )
  }
}

/** The minimal mixin integration from the contract's doc comment. */
const plain = createMixin<HTMLInputElement, [], ElementProps>((handle) => {
  let fieldControl = connectFieldControl(handle)
  return (props) => {
    let f = fieldControl.render({ id: typeof props.id === 'string' ? props.id : undefined })
    return [
      attrs({ ...f.attrs, name: f.name, disabled: f.disabled || undefined }),
      on('focus', () => fieldControl.focus()),
      on('blur', () => fieldControl.blur()),
      on('input', (event) => fieldControl.change(event.currentTarget.value, event)),
    ]
  }
})

function Probe(handle: Handle<{ children: (f: FieldControlRenderResult) => RemixNode }>) {
  let fieldControl = connectFieldControl(handle)
  return () => handle.props.children(fieldControl.render({ id: 'own', name: 'own' }))
}

describe('field-control', () => {
  it('is inert outside a field', (t) => {
    let result: FieldControlRenderResult | undefined
    let { $, cleanup } = render(
      <div>
        <Probe>
          {(f) => {
            result = f
            return null
          }}
        </Probe>
        <input mix={plain()} />
      </div>,
    )
    t.after(cleanup)
    assert.equal(result!.inField, false)
    assert.equal(result!.id, 'own')
    assert.equal(result!.name, 'own')
    assert.equal(result!.describedBy, undefined)
    assert.equal(result!.disabled, false)
    assert.deepEqual(Object.values(result!.attrs).filter(Boolean), [])
    let control = $('input')!
    assert.equal(control.hasAttribute('id'), false)
    assert.equal(control.attributes.length, 0)
  })

  it('inherits a fieldset disabled state outside a field', (t) => {
    let result: FieldControlRenderResult | undefined
    let { cleanup } = render(
      <fieldset.Context disabled>
        <Probe>
          {(f) => {
            result = f
            return null
          }}
        </Probe>
      </fieldset.Context>,
    )
    t.after(cleanup)
    assert.equal(result!.inField, false)
    assert.equal(result!.disabled, true)
    assert.equal(result!.dataAttrs['data-disabled'], '')
  })

  it('wires the minimal mixin integration', async (t) => {
    let { $, act, cleanup } = render(
      <field.Context name="nick" validationMode="onChange" validate={(v) => (v ? null : 'Empty')}>
        <label mix={field.label()}>Nick</label>
        <input mix={plain()} />
        <p mix={field.description()}>Help</p>
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let control = $('input') as HTMLInputElement
    assert.equal(($('label') as HTMLLabelElement).htmlFor, control.id)
    assert.equal(control.name, 'nick')
    assert.equal(control.getAttribute('aria-describedby'), $('p')!.id)

    await act(() => {
      control.value = 'x'
      control.dispatchEvent(new Event('input', { bubbles: true }))
    })
    assert.equal(control.hasAttribute('data-valid'), true)
    assert.equal(control.hasAttribute('data-filled'), true)
    await act(() => {
      control.value = ''
      control.dispatchEvent(new Event('input', { bubbles: true }))
    })
    assert.equal(control.validationMessage, 'Empty')
  })

  it('integrates a custom widget with a hidden validity input', async (t) => {
    let submitted: form.FormValues[] = []
    let { $, act, cleanup } = render(
      <form.Context onFormSubmit={(values) => submitted.push(values)}>
        <form mix={form.root()}>
          <field.Context name="terms">
            <div id="root" mix={field.root()}>
              <div id="label" mix={field.label()}>
                Accept terms
              </div>
              <Check required />
              <div id="error" mix={field.error({ match: 'valueMissing' })}>
                Required
              </div>
            </div>
          </field.Context>
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let check = $('[role=checkbox]') as HTMLElement
    let hidden = $('input') as HTMLInputElement
    assert.equal(check.getAttribute('aria-labelledby'), 'label')
    assert.equal(hidden.name, 'terms')

    await act(() =>
      $('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true })),
    )
    assert.deepEqual(submitted, [])
    assert.equal(document.activeElement, check, 'focuses getFocusElement()')
    assert.equal(check.getAttribute('aria-invalid'), 'true')
    assert.equal($('#root')!.hasAttribute('data-invalid'), true)
    assert.equal(($('#error') as HTMLElement).hidden, false)
    assert.equal(check.getAttribute('aria-describedby'), 'error')

    await act(() => check.click())
    assert.equal(check.hasAttribute('data-filled'), true, 'custom isFilled')
    assert.equal(check.hasAttribute('data-dirty'), true)
    assert.equal(check.hasAttribute('data-valid'), true, 're-validated after submit')

    await act(() =>
      $('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true })),
    )
    assert.deepEqual(submitted, [{ terms: true }])
  })

  it('tracks focus and touched from a component-handle control', async (t) => {
    let { $, act, cleanup } = render(
      <div>
        <field.Context validationMode="onBlur">
          <div id="root" mix={field.root()}>
            <Check required />
          </div>
        </field.Context>
        <button type="button">Other</button>
      </div>,
    )
    t.after(cleanup)
    let check = $('[role=checkbox]') as HTMLElement
    await act(() => check.focus())
    assert.equal($('#root')!.hasAttribute('data-focused'), true)
    await act(() => ($('button') as HTMLButtonElement).focus())
    assert.equal($('#root')!.hasAttribute('data-touched'), true)
    assert.equal($('#root')!.hasAttribute('data-invalid'), true, 'onBlur validation')
  })

  it('takes the field disabled state', (t) => {
    let { $, cleanup } = render(
      <field.Context disabled>
        <Check />
      </field.Context>,
    )
    t.after(cleanup)
    assert.equal($('[role=checkbox]')!.getAttribute('aria-disabled'), 'true')
    assert.equal(($('input') as HTMLInputElement).disabled, true)
  })

  it('focuses a non-labelable control from a <label>', async (t) => {
    let { $, act, cleanup } = render(
      <field.Context>
        <label mix={field.label()}>Accept</label>
        <Check />
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let label = $('label') as HTMLLabelElement
    let check = $('[role=checkbox]') as HTMLElement
    assert.equal(label.htmlFor, check.id)
    await act(() => label.click())
    assert.equal(document.activeElement, check)
  })
})

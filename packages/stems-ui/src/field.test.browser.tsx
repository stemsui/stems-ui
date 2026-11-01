import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { createRoot, type Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as field from './field.ts'
import * as fieldset from './fieldset.ts'
import * as form from './form.ts'
import { input } from './input.ts'
import * as checkbox from './checkbox.ts'
import * as checkboxGroup from './checkbox-group.ts'
import * as radio from './radio.ts'
import * as radioGroup from './radio-group.ts'

function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

// Errors stay shown (with `data-ending-style`) until their exit animation finishes.
async function waitForHidden(element: Element) {
  for (let i = 0; i < 10 && !(element as HTMLElement).hidden; i++) await nextFrame()
  assert.equal((element as HTMLElement).hidden, true, `${element.id} hidden`)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const STATE = ['disabled', 'valid', 'invalid', 'touched', 'dirty', 'filled', 'focused']

function stateOf(element: Element) {
  return STATE.filter((name) => element.hasAttribute(`data-${name}`))
}

describe('field', () => {
  it('wires the label, description and control ids', async (t) => {
    let { $, act, cleanup } = render(
      <field.Context>
        <div mix={field.root()}>
          <label mix={field.label()}>Name</label>
          <input mix={field.control()} />
          <p mix={field.description()}>Visible on your profile</p>
        </div>
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})

    let label = $('label') as HTMLLabelElement
    let control = $('input') as HTMLInputElement
    let description = $('p')!
    assert.ok(control.id)
    assert.equal(label.htmlFor, control.id)
    assert.equal(control.labels?.[0], label)
    assert.ok(label.id)
    assert.ok(description.id)
    // The description renders after the control; the field re-renders once it registered.
    assert.equal(control.getAttribute('aria-describedby'), description.id)
    assert.equal(control.hasAttribute('aria-invalid'), false)
  })

  it('accepts no arguments for every mixin', (t) => {
    let { $, cleanup } = render(
      <field.Context>
        <div mix={field.root()}>
          <div mix={field.label()}>Name</div>
          <input mix={field.control()} />
          <p mix={field.description()}>Help</p>
          <div id="error" mix={field.error()}>
            Error
          </div>
        </div>
      </field.Context>,
    )
    t.after(cleanup)
    assert.ok($('input'))
    assert.equal(($('#error') as HTMLElement).hidden, true)
  })

  it('throws when a part is rendered outside field.Context', (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    let errors: unknown[] = []
    root.addEventListener('error', (event) => void errors.push((event as ErrorEvent).error))
    t.after(() => {
      root.dispose()
      container.remove()
    })
    root.render(<label mix={field.label()}>Name</label>)
    root.flush()
    assert.match(String(errors[0]), /field\.label\(\) must be rendered inside/)
  })

  it('lets the control id from the host win and points the label at it', async (t) => {
    let { $, act, cleanup } = render(
      <field.Context>
        <label mix={field.label()}>Name</label>
        <input id="custom" mix={field.control()} />
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    assert.equal(($('label') as HTMLLabelElement).htmlFor, 'custom')
  })

  it('tracks focused, touched, dirty and filled on every part', async (t) => {
    let { $, act, cleanup } = render(
      <div>
        <field.Context>
          <div id="root" mix={field.root()}>
            <label mix={field.label()}>Name</label>
            <input mix={field.control({ defaultValue: 'Ada' })} />
            <p mix={field.description()}>Help</p>
          </div>
        </field.Context>
        <button type="button">Other</button>
      </div>,
    )
    t.after(cleanup)
    await act(() => {})

    let root = $('#root')!
    let control = $('input') as HTMLInputElement
    for (let element of [root, $('label')!, control, $('p')!]) {
      assert.deepEqual(stateOf(element), ['filled'], element.localName)
    }

    await act(() => control.focus())
    assert.deepEqual(stateOf(root), ['filled', 'focused'])

    await act(() => type(control, 'Grace'))
    assert.deepEqual(stateOf(control), ['dirty', 'filled', 'focused'])

    await act(() => ($('button') as HTMLButtonElement).focus())
    assert.deepEqual(stateOf($('label')!), ['touched', 'dirty', 'filled'])

    await act(() => type(control, ''))
    assert.deepEqual(stateOf($('p')!), ['touched', 'dirty'])

    await act(() => type(control, 'Ada'))
    assert.deepEqual(stateOf(root), ['touched', 'filled'])
  })

  it('validates on submit by default and re-validates on change afterwards', async (t) => {
    let { $, act, cleanup } = render(
      <form.Context>
        <form mix={form.root()}>
          <field.Context>
            <div id="root" mix={field.root()}>
              <input required mix={field.control()} />
              <div id="error" mix={field.error()}>
                <field.Validity>{(state) => state.error}</field.Validity>
              </div>
            </div>
          </field.Context>
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    await act(() => {})

    let control = $('input') as HTMLInputElement
    let error = $('#error') as HTMLElement
    await act(() => type(control, 'a'))
    await act(() => type(control, ''))
    assert.deepEqual(stateOf($('#root')!), [], 'no validation before submit')
    assert.equal(error.hidden, true)

    let prevented = false
    let submit = new Event('submit', { bubbles: true, cancelable: true })
    await act(() => {
      $('form')!.dispatchEvent(submit)
      prevented = submit.defaultPrevented
    })
    assert.equal(prevented, true)
    assert.equal(document.activeElement, control)
    assert.equal(control.getAttribute('aria-invalid'), 'true')
    assert.equal(control.hasAttribute('data-invalid'), true)
    assert.equal(error.hidden, false)
    assert.equal(error.textContent, control.validationMessage)
    assert.equal(control.getAttribute('aria-describedby'), error.id)

    await act(() => type(control, 'Ada'))
    assert.equal(control.hasAttribute('data-valid'), true)
    assert.equal(control.hasAttribute('aria-invalid'), false)
    await waitForHidden(error)
    assert.equal(control.hasAttribute('aria-describedby'), false)
  })

  it('validates on blur with validationMode="onBlur"', async (t) => {
    let { $, act, cleanup } = render(
      <div>
        <field.Context validationMode="onBlur">
          <div id="root" mix={field.root()}>
            <input type="email" mix={field.control()} />
            <div id="type" mix={field.error({ match: 'typeMismatch' })}>
              Enter an email
            </div>
            <div id="valid" mix={field.error({ match: 'valid' })}>
              Looks good
            </div>
          </div>
        </field.Context>
        <button type="button">Other</button>
      </div>,
    )
    t.after(cleanup)
    let control = $('input') as HTMLInputElement

    await act(() => control.focus())
    await act(() => type(control, 'nope'))
    assert.equal(control.hasAttribute('data-invalid'), false, 'not validated while typing')

    await act(() => ($('button') as HTMLButtonElement).focus())
    assert.equal(control.hasAttribute('data-invalid'), true)
    assert.equal(($('#type') as HTMLElement).hidden, false)
    assert.equal(($('#valid') as HTMLElement).hidden, true)

    // While invalid, changes re-validate so the error clears as soon as it is fixed.
    await act(() => type(control, 'ada@example.com'))
    assert.equal(control.hasAttribute('data-valid'), true)
    await waitForHidden($('#type')!)
    assert.equal(($('#valid') as HTMLElement).hidden, false)
  })

  it('runs custom validation on change and applies it with setCustomValidity', async (t) => {
    let calls: unknown[] = []
    let { $, act, cleanup } = render(
      <field.Context
        validationMode="onChange"
        validate={(value) => {
          calls.push(value)
          return value === 'admin' ? ['Reserved name', 'Pick another'] : null
        }}
      >
        <input mix={field.control()} />
        <div id="custom" mix={field.error({ match: 'customError' })} />
        <ul id="all">
          <field.Validity>
            {(state) => state.errors.map((message) => <li>{message}</li>)}
          </field.Validity>
        </ul>
      </field.Context>,
    )
    t.after(cleanup)
    let control = $('input') as HTMLInputElement

    await act(() => type(control, 'admin'))
    assert.deepEqual(calls, ['admin'])
    assert.equal(control.validationMessage, 'Reserved name')
    assert.equal(control.validity.customError, true)
    assert.equal(($('#custom') as HTMLElement).hidden, false)
    assert.equal($('#all')!.textContent, 'Reserved namePick another')

    await act(() => type(control, 'ada'))
    assert.equal(control.validity.valid, true)
    assert.equal(control.hasAttribute('data-valid'), true)
    await waitForHidden($('#custom')!)
  })

  it('checks native constraints before custom validation', async (t) => {
    let calls = 0
    let { $, act, cleanup } = render(
      <field.Context
        validationMode="onChange"
        validate={() => {
          calls++
          return 'custom'
        }}
      >
        <input minLength={3} mix={field.control()} />
        <div id="short" mix={field.error({ match: 'tooShort' })} />
      </field.Context>,
    )
    t.after(cleanup)
    let control = $('input') as HTMLInputElement
    // `tooShort` only applies to user edits, so check `required` with an empty value instead.
    control.required = true
    await act(() => type(control, ''))
    assert.equal(calls, 0)
    assert.equal(control.hasAttribute('data-invalid'), true)
    assert.equal(control.validity.valueMissing, true)
  })

  it('debounces onChange validation with validationDebounceTime', async (t) => {
    let calls: unknown[] = []
    let { $, act, cleanup } = render(
      <field.Context
        validationMode="onChange"
        validationDebounceTime={30}
        validate={(value) => {
          calls.push(value)
          return null
        }}
      >
        <input mix={field.control()} />
      </field.Context>,
    )
    t.after(cleanup)
    let control = $('input') as HTMLInputElement

    await act(() => type(control, 'a'))
    await act(() => type(control, 'ab'))
    await act(() => type(control, 'abc'))
    assert.deepEqual(calls, [])
    await act(() => sleep(60))
    assert.deepEqual(calls, ['abc'])
    assert.equal(control.hasAttribute('data-valid'), true)
  })

  it('supports async validation and ignores stale results', async (t) => {
    let resolvers: Array<(value: string | null) => void> = []
    let { $, act, cleanup } = render(
      <field.Context
        validationMode="onChange"
        validate={() => new Promise<string | null>((resolve) => resolvers.push(resolve))}
      >
        <input mix={field.control()} />
        <div id="error" mix={field.error()}>
          <field.Validity>{(state) => state.error}</field.Validity>
        </div>
      </field.Context>,
    )
    t.after(cleanup)
    let control = $('input') as HTMLInputElement

    await act(() => type(control, 'taken'))
    await act(() => type(control, 'free'))
    assert.equal(resolvers.length, 2)
    await act(async () => {
      resolvers[1]!(null)
      await sleep(0)
    })
    assert.equal(control.hasAttribute('data-valid'), true)
    await act(async () => {
      resolvers[0]!('Taken')
      await sleep(0)
    })
    assert.equal(control.hasAttribute('data-valid'), true, 'stale result ignored')
  })

  it('forces the invalid state with `invalid`', (t) => {
    let { $, cleanup } = render(
      <field.Context invalid>
        <div id="root" mix={field.root()}>
          <input mix={field.control()} />
          <div id="any" mix={field.error()}>
            Invalid
          </div>
          <div id="always" mix={field.error({ match: true })}>
            Always
          </div>
          <div id="never" mix={field.error({ match: false })}>
            Never
          </div>
        </div>
      </field.Context>,
    )
    t.after(cleanup)
    assert.equal($('#root')!.hasAttribute('data-invalid'), true)
    assert.equal($('input')!.getAttribute('aria-invalid'), 'true')
    assert.equal(($('#any') as HTMLElement).hidden, false)
    assert.equal(($('#always') as HTMLElement).hidden, false)
    assert.equal(($('#never') as HTMLElement).hidden, true)
  })

  it('controls dirty and touched with props', (t) => {
    let { $, cleanup } = render(
      <field.Context dirty touched>
        <input mix={field.control()} />
      </field.Context>,
    )
    t.after(cleanup)
    assert.deepEqual(stateOf($('input')!), ['touched', 'dirty'])
  })

  it('disables the control and marks every part', (t) => {
    let { $, cleanup } = render(
      <field.Context disabled name="email">
        <div id="root" mix={field.root()}>
          <label mix={field.label()}>Email</label>
          <input mix={field.control()} />
        </div>
      </field.Context>,
    )
    t.after(cleanup)
    let control = $('input') as HTMLInputElement
    assert.equal(control.disabled, true)
    assert.equal(control.name, 'email')
    for (let element of [$('#root')!, $('label')!, control]) {
      assert.equal(element.hasAttribute('data-disabled'), true)
    }
  })

  it('inherits disabled from fieldset.Context', (t) => {
    let { $, cleanup } = render(
      <fieldset.Context disabled>
        <fieldset mix={fieldset.root()}>
          <field.Context>
            <label mix={field.label()}>Email</label>
            <input mix={field.control()} />
          </field.Context>
        </fieldset>
      </fieldset.Context>,
    )
    t.after(cleanup)
    assert.equal(($('input') as HTMLInputElement).disabled, true)
    assert.equal($('label')!.hasAttribute('data-disabled'), true)
  })

  it('works with a controlled input', async (t) => {
    function Harness(handle: Handle) {
      let value = 'ada'
      return () => (
        <field.Context validationMode="onChange" validate={(v) => (v === 'ADMIN' ? 'No' : null)}>
          <input
            mix={field.control({
              value,
              onValueChange(next) {
                value = next.toUpperCase()
                void handle.update()
              },
            })}
          />
        </field.Context>
      )
    }
    let { $, act, cleanup } = render(<Harness />)
    t.after(cleanup)
    let control = $('input') as HTMLInputElement

    await act(() => type(control, 'admin'))
    assert.equal(control.value, 'ADMIN')
    assert.equal(control.hasAttribute('data-dirty'), true)
    // Validation ran with the typed value; the next edit validates the controlled value.
    await act(() => type(control, 'ADMIN'))
    assert.equal(control.hasAttribute('data-invalid'), true)
  })

  it('syncs with native validation of a plain form', async (t) => {
    let { $, act, cleanup } = render(
      <form>
        <field.Context>
          <div id="root" mix={field.root()}>
            <input required mix={field.control()} />
            <div id="missing" mix={field.error({ match: 'valueMissing' })} />
          </div>
        </field.Context>
      </form>,
    )
    t.after(cleanup)
    await act(() => ($('form') as HTMLFormElement).checkValidity())
    assert.equal($('#root')!.hasAttribute('data-invalid'), true)
    assert.equal(($('#missing') as HTMLElement).hidden, false)
  })

  it('focuses a non-labelable control when its label is clicked', async (t) => {
    let { $, act, cleanup } = render(
      <field.Context>
        <div mix={field.label()}>Name</div>
        <input mix={field.control()} />
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => ($('div') as HTMLElement).click())
    assert.equal(document.activeElement, $('input'))
  })

  it('exposes validate() through actionsRef and context', async (t) => {
    let actions: field.FieldActions | null = null
    let { $, act, cleanup } = render(
      <field.Context actionsRef={(value) => (actions = value)}>
        <input required mix={field.control()} />
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => actions!.validate())
    assert.equal($('input')!.hasAttribute('data-invalid'), true)
  })

  it('reads the initial value of a select from the DOM', async (t) => {
    let { $, act, cleanup } = render(
      <field.Context>
        <select mix={field.control()}>
          <option value="a">A</option>
          <option value="b">B</option>
        </select>
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let select = $('select') as HTMLSelectElement
    assert.deepEqual(stateOf(select), ['filled'])
    await act(() => {
      select.value = 'b'
      select.dispatchEvent(new Event('input', { bubbles: true }))
    })
    assert.deepEqual(stateOf(select), ['dirty', 'filled'])
  })

  it('works with a textarea', async (t) => {
    let { $, act, cleanup } = render(
      <field.Context validationMode="onChange">
        <textarea required mix={input()} />
      </field.Context>,
    )
    t.after(cleanup)
    let textarea = $('textarea') as HTMLTextAreaElement
    await act(() => type(textarea, 'x'))
    assert.deepEqual(stateOf(textarea), ['valid', 'dirty', 'filled'])
  })
})

describe('field.ItemContext', () => {
  it('scopes labels and descriptions to the item control', async (t) => {
    let { $, act, cleanup } = render(
      <field.Context>
        <checkboxGroup.Context>
          <div aria-label="Group" mix={checkboxGroup.root()}>
            <field.ItemContext>
              <div id="item" mix={field.item()}>
                <div id="item-label" mix={field.label()}>
                  Item
                </div>
                <checkbox.Context>
                  <span mix={checkbox.root()} />
                </checkbox.Context>
                <p id="item-description" mix={field.description()}>
                  Described after the control
                </p>
              </div>
            </field.ItemContext>
          </div>
        </checkboxGroup.Context>
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let root = $('[role="checkbox"]') as HTMLElement
    assert.equal(root.getAttribute('aria-labelledby'), 'item-label')
    assert.equal(root.getAttribute('aria-describedby'), 'item-description')
    // The group is not described by the item's description.
    assert.equal($('[role="group"]')!.hasAttribute('aria-describedby'), false)
    // A non-<label> item label focuses the item's control.
    await act(() => ($('#item-label') as HTMLElement).click())
    assert.equal(document.activeElement, root)
    assert.equal(root.getAttribute('aria-checked'), 'false')
  })

  it('follows a control id from the control', async (t) => {
    let { $, act, cleanup } = render(
      <field.Context>
        <radioGroup.Context>
          <div aria-label="Group" mix={radioGroup.root()}>
            <field.ItemContext>
              <label mix={field.label()}>A</label>
              <radio.Context value="a" id="own-id">
                <span mix={radio.root()} />
              </radio.Context>
            </field.ItemContext>
          </div>
        </radioGroup.Context>
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    assert.equal(($('label') as HTMLLabelElement).htmlFor, 'own-id')
    assert.equal(($('input') as HTMLInputElement).id, 'own-id')
    await act(() => ($('label') as HTMLLabelElement).click())
    assert.equal($('[role="radio"]')!.getAttribute('aria-checked'), 'true')
  })

  it('renders item state attributes with the item disabled state', async (t) => {
    let { $, $$, cleanup } = render(
      <field.Context invalid>
        <field.ItemContext disabled>
          <div id="item" mix={field.item()}>
            <label mix={field.label()}>A</label>
            <p mix={field.description()}>About A</p>
          </div>
        </field.ItemContext>
      </field.Context>,
    )
    t.after(cleanup)
    assert.deepEqual(stateOf($('#item')!), ['disabled', 'invalid'])
    for (let part of [...$$('label, p')]) assert.deepEqual(stateOf(part), ['disabled', 'invalid'])
  })

  it('does not capture the parts of a field nested inside it', async (t) => {
    let { $, act, cleanup } = render(
      <field.Context>
        <field.ItemContext>
          <field.Context>
            <label mix={field.label()}>Inner</label>
            <input mix={field.control()} />
          </field.Context>
        </field.ItemContext>
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    assert.equal(($('label') as HTMLLabelElement).htmlFor, ($('input') as HTMLInputElement).id)
  })

  it('accepts no arguments and throws outside a field or item', (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    let errors: unknown[] = []
    root.addEventListener('error', (event) => void errors.push((event as ErrorEvent).error))
    t.after(() => {
      root.dispose()
      container.remove()
    })
    root.render(
      <div>
        <field.ItemContext>x</field.ItemContext>
      </div>,
    )
    root.flush()
    assert.match(String(errors[0]), /field\.ItemContext must be rendered inside/)
    root.render(
      <field.Context>
        <div mix={field.item()} />
      </field.Context>,
    )
    root.flush()
    assert.match(String(errors[1]), /field\.item\(\) must be rendered inside <field\.ItemContext>/)
  })
})

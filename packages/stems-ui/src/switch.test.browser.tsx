// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/toggle.test.tsx).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { createRoot, on, type Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as field from './field.ts'
import * as fieldset from './fieldset.ts'
import * as form from './form.ts'
import * as switch_ from './switch.ts'

function getHiddenInput(container: Element) {
  return container.querySelector('input[type="checkbox"]') as HTMLInputElement
}

function key(target: Element, type: 'keydown' | 'keyup', value: string) {
  target.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, key: value }))
}

describe('switch', () => {
  it('renders switch semantics and state attributes on a span host', (t) => {
    let { $, container, cleanup } = render(
      <switch_.Context>
        <span aria-label="Notifications" mix={switch_.root()}>
          <span mix={switch_.thumb()} />
        </span>
      </switch_.Context>,
    )
    t.after(cleanup)

    let control = $('[role="switch"]') as HTMLElement
    let thumb = control.firstElementChild as HTMLElement

    expect(control.tabIndex).toBe(0)
    expect(control.getAttribute('aria-checked')).toBe('false')
    expect(control.hasAttribute('data-unchecked')).toBe(true)
    expect(control.hasAttribute('data-checked')).toBe(false)
    expect(control.hasAttribute('data-disabled')).toBe(false)
    expect(thumb.getAttribute('data-unchecked')).toBe('')
    expect(thumb.hasAttribute('data-checked')).toBe(false)

    let input = getHiddenInput(container)
    expect(input.getAttribute('aria-hidden')).toBe('true')
    expect(input.tabIndex).toBe(-1)
    expect(input.checked).toBe(false)
  })

  it('toggles on click and updates root, thumb, and hidden input (uncontrolled)', async (t) => {
    let changes: boolean[] = []
    let events: switch_.SwitchChangeEvent[] = []
    let inputRef: HTMLInputElement | null = null

    let { $, act, container, cleanup } = render(
      <div mix={switch_.onSwitchChange((event) => void events.push(event))}>
        <switch_.Context
          defaultChecked
          name="notifications"
          inputRef={(input) => {
            inputRef = input
          }}
          onCheckedChange={(checked) => void changes.push(checked)}
        >
          <button aria-label="Notifications" mix={switch_.root()}>
            <span mix={switch_.thumb()} />
          </button>
        </switch_.Context>
      </div>,
    )
    t.after(cleanup)

    let control = $('button') as HTMLButtonElement
    let thumb = $('button > span') as HTMLElement
    let input = getHiddenInput(container)

    expect(inputRef).toBe(input)
    expect(control.type).toBe('button')
    expect(control.getAttribute('tabindex')).toBe(null)
    expect(control.getAttribute('aria-checked')).toBe('true')
    expect(control.hasAttribute('data-checked')).toBe(true)
    expect(input.checked).toBe(true)

    await act(() => control.click())

    expect(control.getAttribute('aria-checked')).toBe('false')
    expect(control.hasAttribute('data-checked')).toBe(false)
    expect(control.hasAttribute('data-unchecked')).toBe(true)
    expect(thumb.hasAttribute('data-unchecked')).toBe(true)
    expect(input.checked).toBe(false)
    expect(changes).toEqual([false])
    expect(events.length).toBe(1)
    expect(events[0]).toBeInstanceOf(switch_.SwitchChangeEvent)
    expect(events[0]?.checked).toBe(false)
    expect(events[0]?.target).toBe(control)
  })

  it('passes the triggering DOM event to onCheckedChange', async (t) => {
    let received: Event[] = []
    let { $, act, cleanup } = render(
      <switch_.Context onCheckedChange={(_checked, event) => void received.push(event)}>
        <span aria-label="Wi-Fi" mix={switch_.root()} />
      </switch_.Context>,
    )
    t.after(cleanup)

    await act(() => ($('[role="switch"]') as HTMLElement).click())

    expect(received.length).toBe(1)
    expect(received[0]).toBeInstanceOf(Event)
  })

  it('toggles a span host with Space (on keyup) and Enter', async (t) => {
    let changes: boolean[] = []
    let { $, act, cleanup } = render(
      <switch_.Context onCheckedChange={(checked) => void changes.push(checked)}>
        <span aria-label="Standalone span" mix={switch_.root()} />
      </switch_.Context>,
    )
    t.after(cleanup)

    let control = $('[role="switch"]') as HTMLElement

    let keydown = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: ' ' })
    await act(() => control.dispatchEvent(keydown))
    expect(keydown.defaultPrevented).toBe(true)
    expect(control.getAttribute('aria-checked')).toBe('false')

    await act(() => key(control, 'keyup', ' '))
    expect(control.getAttribute('aria-checked')).toBe('true')
    expect(control.hasAttribute('data-checked')).toBe(true)

    await act(() => key(control, 'keydown', 'Enter'))
    expect(control.getAttribute('aria-checked')).toBe('false')
    expect(changes).toEqual([true, false])
  })

  it('supports controlled state', async (t) => {
    let changes: boolean[] = []

    function Controlled(handle: Handle) {
      let checked = false
      return () => (
        <div>
          <switch_.Context
            checked={checked}
            onCheckedChange={(next) => {
              changes.push(next)
              checked = next
              void handle.update()
            }}
          >
            <span aria-label="Controlled" mix={switch_.root()} />
          </switch_.Context>
          <button
            id="external"
            mix={on('click', () => {
              checked = !checked
              void handle.update()
            })}
          >
            External
          </button>
        </div>
      )
    }

    let { $, act, container, cleanup } = render(<Controlled />)
    t.after(cleanup)

    let control = $('[role="switch"]') as HTMLElement
    let input = getHiddenInput(container)

    await act(() => control.click())
    expect(control.getAttribute('aria-checked')).toBe('true')
    expect(input.checked).toBe(true)
    expect(changes).toEqual([true])

    await act(() => ($('#external') as HTMLElement).click())
    expect(control.getAttribute('aria-checked')).toBe('false')
    expect(control.hasAttribute('data-unchecked')).toBe(true)
    expect(input.checked).toBe(false)
    expect(changes).toEqual([true])
  })

  it('does not change a controlled switch whose owner ignores the change', async (t) => {
    let changes: boolean[] = []
    let { $, act, container, cleanup } = render(
      <switch_.Context checked={false} onCheckedChange={(next) => void changes.push(next)}>
        <span aria-label="Stuck" mix={switch_.root()} />
      </switch_.Context>,
    )
    t.after(cleanup)

    let control = $('[role="switch"]') as HTMLElement
    await act(() => control.click())
    await act(() => Promise.resolve())

    expect(changes).toEqual([true])
    expect(control.getAttribute('aria-checked')).toBe('false')
    expect(getHiddenInput(container).checked).toBe(false)
  })

  it('does not toggle when disabled or read-only', async (t) => {
    let changes: boolean[] = []
    let { $$, act, container, cleanup } = render(
      <div>
        <switch_.Context defaultChecked disabled onCheckedChange={(c) => void changes.push(c)}>
          <span aria-label="Disabled" mix={switch_.root()}>
            <span mix={switch_.thumb()} />
          </span>
        </switch_.Context>
        <switch_.Context defaultChecked readOnly onCheckedChange={(c) => void changes.push(c)}>
          <button aria-label="Read only" mix={switch_.root()}>
            <span mix={switch_.thumb()} />
          </button>
        </switch_.Context>
      </div>,
    )
    t.after(cleanup)

    let [disabled, readOnly] = [...$$('[role="switch"]')]
    let [disabledInput, readOnlyInput] = [
      ...container.querySelectorAll('input[type="checkbox"]'),
    ] as HTMLInputElement[]

    expect(disabled!.getAttribute('aria-disabled')).toBe('true')
    expect(disabled!.hasAttribute('tabindex')).toBe(false)
    expect(disabled!.hasAttribute('data-disabled')).toBe(true)
    expect(disabled!.firstElementChild!.hasAttribute('data-disabled')).toBe(true)
    expect(disabledInput!.disabled).toBe(true)

    expect(readOnly!.getAttribute('aria-readonly')).toBe('true')
    expect(readOnly!.hasAttribute('data-readonly')).toBe(true)
    expect(readOnly!.firstElementChild!.hasAttribute('data-readonly')).toBe(true)
    expect((readOnly as HTMLButtonElement).disabled).toBe(false)

    await act(() => {
      disabled!.click()
      key(disabled!, 'keydown', 'Enter')
      readOnly!.click()
      disabledInput!.click()
      readOnlyInput!.click()
    })

    expect(disabled!.getAttribute('aria-checked')).toBe('true')
    expect(readOnly!.getAttribute('aria-checked')).toBe('true')
    expect(disabledInput!.checked).toBe(true)
    expect(readOnlyInput!.checked).toBe(true)
    expect(changes).toEqual([])
  })

  it('disables a button host natively', (t) => {
    let { $, cleanup } = render(
      <switch_.Context disabled>
        <button aria-label="Disabled" mix={switch_.root()} />
      </switch_.Context>,
    )
    t.after(cleanup)

    let control = $('button') as HTMLButtonElement
    expect(control.disabled).toBe(true)
    expect(control.hasAttribute('aria-disabled')).toBe(false)
    expect(control.hasAttribute('data-disabled')).toBe(true)
  })

  it('marks required switches and validates the hidden input', (t) => {
    let { $, container, cleanup } = render(
      <form>
        <switch_.Context required name="terms">
          <span aria-label="Accept terms" mix={switch_.root()}>
            <span mix={switch_.thumb()} />
          </span>
        </switch_.Context>
      </form>,
    )
    t.after(cleanup)

    let control = $('[role="switch"]') as HTMLElement
    expect(control.getAttribute('aria-required')).toBe('true')
    expect(control.hasAttribute('data-required')).toBe(true)
    expect(control.firstElementChild!.hasAttribute('data-required')).toBe(true)

    let form = container.querySelector('form') as HTMLFormElement
    expect(getHiddenInput(container).required).toBe(true)
    expect(form.checkValidity()).toBe(false)
  })

  it('participates in forms with name, value, form, and uncheckedValue', async (t) => {
    let { $, act, container, cleanup } = render(
      <div>
        <form id="settings">
          <switch_.Context name="wifi">
            <span aria-label="Wi-Fi" id="wifi" mix={switch_.root()} />
          </switch_.Context>
          <switch_.Context name="mode" value="dark" uncheckedValue="light">
            <span aria-label="Dark mode" id="mode" mix={switch_.root()} />
          </switch_.Context>
          <switch_.Context name="off" defaultChecked disabled>
            <span aria-label="Disabled" mix={switch_.root()} />
          </switch_.Context>
        </form>
        <switch_.Context name="outside" form="settings" defaultChecked>
          <span aria-label="Outside" mix={switch_.root()} />
        </switch_.Context>
      </div>,
    )
    t.after(cleanup)

    let form = container.querySelector('form') as HTMLFormElement
    let data = () => [...new FormData(form).entries()]

    expect(data()).toEqual([
      ['mode', 'light'],
      ['outside', 'on'],
    ])

    await act(() => {
      ;($('#wifi') as HTMLElement).click()
      ;($('#mode') as HTMLElement).click()
    })

    expect(data()).toEqual([
      ['wifi', 'on'],
      ['mode', 'dark'],
      ['outside', 'on'],
    ])
  })

  it('fires native change events on the hidden input for form listeners', async (t) => {
    let formChanges = 0
    let { $, act, cleanup } = render(
      <form mix={on('change', () => void formChanges++)}>
        <switch_.Context name="a">
          <span aria-label="A" mix={switch_.root()} />
        </switch_.Context>
      </form>,
    )
    t.after(cleanup)

    await act(() => ($('[role="switch"]') as HTMLElement).click())
    expect(formChanges).toBe(1)
  })

  it('does not submit a form when the root is a button', async (t) => {
    let submits = 0
    let { $, act, cleanup } = render(
      <form
        mix={on('submit', (event) => {
          event.preventDefault()
          submits++
        })}
      >
        <switch_.Context>
          <button aria-label="A" mix={switch_.root()} />
        </switch_.Context>
      </form>,
    )
    t.after(cleanup)

    await act(() => ($('button') as HTMLElement).click())
    expect(submits).toBe(0)
    expect($('button')!.getAttribute('aria-checked')).toBe('true')
  })

  it('toggles once when a wrapping label is clicked, and names the span root', async (t) => {
    let changes: boolean[] = []
    let { $, act, cleanup } = render(
      <label>
        <switch_.Context onCheckedChange={(c) => void changes.push(c)}>
          <span mix={switch_.root()}>
            <span mix={switch_.thumb()} />
          </span>
        </switch_.Context>
        <span id="text">Notifications</span>
      </label>,
    )
    t.after(cleanup)

    await act(() => {})
    let control = $('[role="switch"]') as HTMLElement
    let label = $('label') as HTMLLabelElement

    expect(label.id).not.toBe('')
    expect(control.getAttribute('aria-labelledby')).toBe(label.id)

    await act(() => ($('#text') as HTMLElement).click())
    expect(control.getAttribute('aria-checked')).toBe('true')

    await act(() => control.click())
    expect(control.getAttribute('aria-checked')).toBe('false')

    await act(() => (control.firstElementChild as HTMLElement).click())
    expect(control.getAttribute('aria-checked')).toBe('true')

    expect(changes).toEqual([true, false, true])
  })

  it('supports sibling labels through the hidden input id', async (t) => {
    let { $, act, cleanup } = render(
      <div>
        <label for="airplane">Airplane mode</label>
        <switch_.Context id="airplane">
          <span mix={switch_.root()} />
        </switch_.Context>
      </div>,
    )
    t.after(cleanup)

    await act(() => {})
    let control = $('[role="switch"]') as HTMLElement
    let label = $('label') as HTMLLabelElement
    expect(label.id).not.toBe('')
    expect(control.getAttribute('aria-labelledby')).toBe(label.id)

    await act(() => label.click())
    expect(control.getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(control)
  })

  it('does not add aria-labelledby when the host is already named', async (t) => {
    let { $, act, cleanup } = render(
      <label>
        <switch_.Context>
          <span aria-label="Explicit" mix={switch_.root()} />
        </switch_.Context>
        Text
      </label>,
    )
    t.after(cleanup)
    await act(() => {})

    expect($('[role="switch"]')!.hasAttribute('aria-labelledby')).toBe(false)
  })

  it('redirects focus from the hidden input to the root', (t) => {
    let { $, container, cleanup } = render(
      <switch_.Context>
        <span aria-label="Focus" mix={switch_.root()} />
      </switch_.Context>,
    )
    t.after(cleanup)

    getHiddenInput(container).focus()
    expect(document.activeElement).toBe($('[role="switch"]'))
  })

  it('lets explicit host props win', (t) => {
    let { $, cleanup } = render(
      <switch_.Context>
        <span aria-label="Custom" tabIndex={-1} mix={switch_.root()} />
      </switch_.Context>,
    )
    t.after(cleanup)

    expect(($('[role="switch"]') as HTMLElement).tabIndex).toBe(-1)
  })

  it('reports a helpful error outside a Context', (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    let errors: unknown[] = []
    root.addEventListener('error', (event) => void errors.push((event as ErrorEvent).error))
    t.after(() => {
      root.dispose()
      container.remove()
    })

    root.render(<span mix={switch_.root()} />)
    root.flush()

    expect(String(errors[0])).toMatch(/switch_\.root\(\) must be rendered inside/)
  })
})

function submit(formNode: Element) {
  formNode.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
}

describe('switch in a field', () => {
  it('is labelled and described by the field and takes its name', async (t) => {
    let { $, act, container, cleanup } = render(
      <field.Context name="alerts">
        <label mix={field.label()}>Alerts</label>
        <switch_.Context name="ignored">
          <span mix={switch_.root()}>
            <span mix={switch_.thumb()} />
          </span>
        </switch_.Context>
        <p mix={field.description()}>Email me</p>
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let label = $('label') as HTMLLabelElement
    let control = $('[role="switch"]') as HTMLElement
    let input = getHiddenInput(container)
    expect(label.htmlFor).toBe(input.id)
    expect(input.name).toBe('alerts')
    expect(control.getAttribute('aria-labelledby')).toBe(label.id)
    expect(control.getAttribute('aria-describedby')).toBe($('p')!.id)

    await act(() => label.click())
    expect(control.getAttribute('aria-checked')).toBe('true')
    expect(control.hasAttribute('data-dirty')).toBe(true)
    expect(control.hasAttribute('data-filled')).toBe(true)
    expect(($('span > span') as HTMLElement).hasAttribute('data-filled')).toBe(true)
  })

  it('labels a button root through aria-labelledby', async (t) => {
    let { $, act, cleanup } = render(
      <field.Context>
        <label mix={field.label()}>Alerts</label>
        <switch_.Context>
          <button mix={switch_.root()} />
        </switch_.Context>
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    expect($('button')!.getAttribute('aria-labelledby')).toBe($('label')!.id)
  })

  it('blocks an invalid submission, focuses the root and re-validates on change', async (t) => {
    let submitted: form.FormValues[] = []
    let { $, act, cleanup } = render(
      <form.Context onFormSubmit={(values) => void submitted.push(values)}>
        <form mix={form.root()}>
          <field.Context name="terms">
            <div id="root" mix={field.root()}>
              <span id="label" mix={field.label()}>
                Accept
              </span>
              <switch_.Context required>
                <span mix={switch_.root()}>
                  <span mix={switch_.thumb()} />
                </span>
              </switch_.Context>
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
    let control = $('[role="switch"]') as HTMLElement
    let thumb = $('[role="switch"] > span') as HTMLElement
    expect(control.getAttribute('aria-labelledby')).toBe('label')

    await act(() => submit($('form')!))
    expect(submitted).toEqual([])
    expect(document.activeElement).toBe(control)
    expect(control.getAttribute('aria-invalid')).toBe('true')
    expect(control.hasAttribute('data-invalid')).toBe(true)
    expect(thumb.hasAttribute('data-invalid')).toBe(true)
    expect(thumb.hasAttribute('aria-invalid')).toBe(false)
    expect(control.getAttribute('aria-describedby')).toBe('error')
    expect(($('#error') as HTMLElement).hidden).toBe(false)

    await act(() => control.click())
    expect(control.hasAttribute('data-valid')).toBe(true)
    expect(control.hasAttribute('aria-invalid')).toBe(false)
    await act(() => submit($('form')!))
    expect(submitted).toEqual([{ terms: true }])
  })

  it('runs custom validation with the next checked state', async (t) => {
    let seen: unknown[] = []
    let { $, act, cleanup } = render(
      <field.Context
        validationMode="onChange"
        validate={(value) => {
          seen.push(value)
          return value ? 'Must stay off' : null
        }}
      >
        <switch_.Context checked={false}>
          <span aria-label="Mode" mix={switch_.root()} />
        </switch_.Context>
      </field.Context>,
    )
    t.after(cleanup)
    let control = $('[role="switch"]') as HTMLElement
    await act(() => control.click())
    expect(seen).toEqual([true])
    expect(control.getAttribute('aria-invalid')).toBe('true')
  })

  it('shows server errors until the value changes', async (t) => {
    let { $, act, cleanup } = render(
      <form.Context errors={{ alerts: 'Not allowed' }}>
        <form mix={form.root()}>
          <field.Context name="alerts">
            <switch_.Context>
              <span aria-label="Alerts" mix={switch_.root()} />
            </switch_.Context>
            <div mix={field.error()}>
              <field.Validity>{(state) => state.error}</field.Validity>
            </div>
          </field.Context>
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let control = $('[role="switch"]') as HTMLElement
    expect(control.getAttribute('aria-invalid')).toBe('true')
    expect($('div')!.textContent).toBe('Not allowed')
    await act(() => control.click())
    expect(control.hasAttribute('aria-invalid')).toBe(false)
    expect(control.hasAttribute('data-invalid')).toBe(false)
  })

  it('tracks focused and touched', async (t) => {
    let { $, act, cleanup } = render(
      <div>
        <field.Context>
          <switch_.Context>
            <span aria-label="Alerts" mix={switch_.root()} />
          </switch_.Context>
        </field.Context>
        <button>Other</button>
      </div>,
    )
    t.after(cleanup)
    let control = $('[role="switch"]') as HTMLElement
    await act(() => control.focus())
    expect(control.hasAttribute('data-focused')).toBe(true)
    await act(() => ($('button') as HTMLElement).focus())
    expect(control.hasAttribute('data-focused')).toBe(false)
    expect(control.hasAttribute('data-touched')).toBe(true)
  })

  it('is disabled by the field or an enclosing fieldset', async (t) => {
    let { $, $$, act, cleanup } = render(
      <div>
        <field.Context disabled>
          <switch_.Context>
            <span aria-label="A" mix={switch_.root()} />
          </switch_.Context>
        </field.Context>
        <fieldset.Context disabled>
          <switch_.Context>
            <button aria-label="B" mix={switch_.root()} />
          </switch_.Context>
        </fieldset.Context>
      </div>,
    )
    t.after(cleanup)
    let [a, b] = [...$$('[role="switch"]')] as HTMLElement[]
    let [inputA, inputB] = [...$$('input')] as HTMLInputElement[]
    expect(a!.getAttribute('aria-disabled')).toBe('true')
    expect(a!.hasAttribute('data-disabled')).toBe(true)
    expect(a!.hasAttribute('tabindex')).toBe(false)
    expect(inputA!.disabled).toBe(true)
    expect((b as HTMLButtonElement).disabled).toBe(true)
    expect(inputB!.disabled).toBe(true)
    await act(() => a!.click())
    expect(a!.getAttribute('aria-checked')).toBe('false')
    expect($('[role="switch"]')).toBe(a!)
  })
})

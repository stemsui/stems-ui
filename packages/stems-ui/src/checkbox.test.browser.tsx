import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { createRoot, on, type Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as checkbox from './checkbox.ts'
import * as field from './field.ts'
import * as fieldset from './fieldset.ts'
import * as form from './form.ts'

function getHiddenInput(container: Element) {
  return container.querySelector('input[type="checkbox"]') as HTMLInputElement
}

function key(target: Element, type: 'keydown' | 'keyup', value: string) {
  let event = new KeyboardEvent(type, { bubbles: true, cancelable: true, key: value })
  target.dispatchEvent(event)
  return event
}

describe('checkbox', () => {
  it('renders checkbox semantics and state attributes on a span host', (t) => {
    let { $, container, cleanup } = render(
      <checkbox.Context>
        <span aria-label="Accept" mix={checkbox.root()}>
          <span mix={checkbox.indicator()} />
        </span>
      </checkbox.Context>,
    )
    t.after(cleanup)

    let control = $('[role="checkbox"]') as HTMLElement
    let indicator = control.firstElementChild as HTMLElement

    expect(control.tabIndex).toBe(0)
    expect(control.getAttribute('aria-checked')).toBe('false')
    expect(control.getAttribute('data-unchecked')).toBe('')
    expect(control.hasAttribute('data-checked')).toBe(false)
    expect(control.hasAttribute('data-indeterminate')).toBe(false)
    expect(control.hasAttribute('data-disabled')).toBe(false)
    expect(indicator.hasAttribute('data-unchecked')).toBe(true)
    expect(indicator.hidden).toBe(true)
    expect(indicator.getAttribute('aria-hidden')).toBe('true')

    let input = getHiddenInput(container)
    expect(input.getAttribute('aria-hidden')).toBe('true')
    expect(input.tabIndex).toBe(-1)
    expect(input.checked).toBe(false)
  })

  it('toggles on click and updates root, indicator, and hidden input (uncontrolled)', async (t) => {
    let changes: boolean[] = []
    let events: checkbox.CheckboxChangeEvent[] = []
    let inputRef: HTMLInputElement | null = null

    let { $, act, container, cleanup } = render(
      <div mix={checkbox.onCheckboxChange((event) => void events.push(event))}>
        <checkbox.Context
          defaultChecked
          name="terms"
          inputRef={(input) => {
            inputRef = input
          }}
          onCheckedChange={(checked) => void changes.push(checked)}
        >
          <button aria-label="Accept" mix={checkbox.root()}>
            <span mix={checkbox.indicator()} />
          </button>
        </checkbox.Context>
      </div>,
    )
    t.after(cleanup)

    let control = $('button') as HTMLButtonElement
    let indicator = $('button > span') as HTMLElement
    let input = getHiddenInput(container)

    expect(inputRef).toBe(input)
    expect(control.type).toBe('button')
    expect(control.getAttribute('tabindex')).toBe(null)
    expect(control.getAttribute('aria-checked')).toBe('true')
    expect(control.hasAttribute('data-checked')).toBe(true)
    expect(indicator.hidden).toBe(false)
    expect(indicator.hasAttribute('data-checked')).toBe(true)
    expect(input.checked).toBe(true)

    await act(() => control.click())

    expect(control.getAttribute('aria-checked')).toBe('false')
    expect(control.hasAttribute('data-checked')).toBe(false)
    expect(control.hasAttribute('data-unchecked')).toBe(true)
    expect(indicator.hasAttribute('data-unchecked')).toBe(true)
    expect(input.checked).toBe(false)
    expect(changes).toEqual([false])
    expect(events.length).toBe(1)
    expect(events[0]).toBeInstanceOf(checkbox.CheckboxChangeEvent)
    expect(events[0]?.checked).toBe(false)
    expect(events[0]?.value).toBe('terms')
    expect(events[0]?.target).toBe(control)
  })

  it('passes the triggering DOM event to onCheckedChange', async (t) => {
    let received: Event[] = []
    let { $, act, cleanup } = render(
      <checkbox.Context onCheckedChange={(_checked, event) => void received.push(event)}>
        <span aria-label="Accept" mix={checkbox.root()} />
      </checkbox.Context>,
    )
    t.after(cleanup)

    await act(() => ($('[role="checkbox"]') as HTMLElement).click())

    expect(received.length).toBe(1)
    expect(received[0]).toBeInstanceOf(Event)
  })

  it('toggles a span host with Space on keyup, and ignores Enter', async (t) => {
    let changes: boolean[] = []
    let { $, act, cleanup } = render(
      <checkbox.Context onCheckedChange={(checked) => void changes.push(checked)}>
        <span aria-label="Accept" mix={checkbox.root()} />
      </checkbox.Context>,
    )
    t.after(cleanup)

    let control = $('[role="checkbox"]') as HTMLElement

    let spaceDown = key(control, 'keydown', ' ')
    expect(spaceDown.defaultPrevented).toBe(true)
    expect(changes).toEqual([])
    await act(() => key(control, 'keyup', ' '))
    expect(changes).toEqual([true])
    expect(control.getAttribute('aria-checked')).toBe('true')

    let enter = key(control, 'keydown', 'Enter')
    expect(enter.defaultPrevented).toBe(true)
    await act(() => key(control, 'keyup', 'Enter'))
    expect(changes).toEqual([true])
  })

  it('prevents Enter on a button host so it does not activate', (t) => {
    let { $, cleanup } = render(
      <checkbox.Context>
        <button aria-label="Accept" mix={checkbox.root()} />
      </checkbox.Context>,
    )
    t.after(cleanup)

    expect(key($('button') as HTMLElement, 'keydown', 'Enter').defaultPrevented).toBe(true)
  })

  it('supports controlled state', async (t) => {
    let changes: boolean[] = []

    function Controlled(handle: Handle) {
      let checked = false
      return () => (
        <div>
          <checkbox.Context
            checked={checked}
            onCheckedChange={(next) => {
              changes.push(next)
              checked = next
              void handle.update()
            }}
          >
            <span aria-label="Accept" mix={checkbox.root()} />
          </checkbox.Context>
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

    let control = $('[role="checkbox"]') as HTMLElement
    await act(() => control.click())
    expect(changes).toEqual([true])
    expect(control.getAttribute('aria-checked')).toBe('true')
    expect(getHiddenInput(container).checked).toBe(true)

    await act(() => ($('#external') as HTMLElement).click())
    expect(control.getAttribute('aria-checked')).toBe('false')
    expect(getHiddenInput(container).checked).toBe(false)
    expect(changes).toEqual([true])
  })

  it('does not change a controlled checkbox whose owner ignores the change', async (t) => {
    let changes: boolean[] = []
    let { $, act, container, cleanup } = render(
      <checkbox.Context checked={false} onCheckedChange={(next) => void changes.push(next)}>
        <span aria-label="Stuck" mix={checkbox.root()} />
      </checkbox.Context>,
    )
    t.after(cleanup)

    let control = $('[role="checkbox"]') as HTMLElement
    await act(() => control.click())
    await act(() => Promise.resolve())

    expect(changes).toEqual([true])
    expect(control.getAttribute('aria-checked')).toBe('false')
    expect(getHiddenInput(container).checked).toBe(false)
  })

  it('renders the mixed state and sets the native indeterminate property', async (t) => {
    let changes: boolean[] = []
    let { $, act, container, cleanup } = render(
      <checkbox.Context indeterminate onCheckedChange={(next) => void changes.push(next)}>
        <span aria-label="Mixed" mix={checkbox.root()}>
          <span mix={checkbox.indicator()} />
        </span>
      </checkbox.Context>,
    )
    t.after(cleanup)

    let control = $('[role="checkbox"]') as HTMLElement
    let indicator = control.firstElementChild as HTMLElement
    await act(() => Promise.resolve())

    expect(control.getAttribute('aria-checked')).toBe('mixed')
    expect(control.getAttribute('data-indeterminate')).toBe('')
    expect(control.hasAttribute('data-checked')).toBe(false)
    expect(control.hasAttribute('data-unchecked')).toBe(false)
    expect(indicator.getAttribute('data-indeterminate')).toBe('')
    expect(indicator.hidden).toBe(false)
    expect(getHiddenInput(container).indeterminate).toBe(true)

    // `indeterminate` is controlled by the app: clicking ticks the checkbox but stays mixed.
    await act(() => control.click())
    expect(changes).toEqual([true])
    expect(control.getAttribute('aria-checked')).toBe('mixed')
    expect(getHiddenInput(container).checked).toBe(true)
    expect(getHiddenInput(container).indeterminate).toBe(true)
  })

  it('keeps the indicator visible while unticked with keepMounted', (t) => {
    let { $, cleanup } = render(
      <checkbox.Context>
        <span aria-label="Accept" mix={checkbox.root()}>
          <span mix={checkbox.indicator({ keepMounted: true })} />
        </span>
      </checkbox.Context>,
    )
    t.after(cleanup)

    let indicator = $('[role="checkbox"] > span') as HTMLElement
    expect(indicator.hidden).toBe(false)
    expect(indicator.hasAttribute('data-unchecked')).toBe(true)
  })

  it('does not toggle when disabled or read-only', async (t) => {
    let changes: boolean[] = []
    let { $$, act, container, cleanup } = render(
      <div>
        <checkbox.Context defaultChecked disabled onCheckedChange={(c) => void changes.push(c)}>
          <span aria-label="Disabled" mix={checkbox.root()}>
            <span mix={checkbox.indicator()} />
          </span>
        </checkbox.Context>
        <checkbox.Context defaultChecked readOnly onCheckedChange={(c) => void changes.push(c)}>
          <button aria-label="Read only" mix={checkbox.root()} />
        </checkbox.Context>
      </div>,
    )
    t.after(cleanup)

    let [disabled, readOnly] = [...$$('[role="checkbox"]')] as HTMLElement[]
    let [disabledInput, readOnlyInput] = [
      ...container.querySelectorAll('input[type="checkbox"]'),
    ] as HTMLInputElement[]

    expect(disabled.getAttribute('aria-disabled')).toBe('true')
    expect(disabled.hasAttribute('tabindex')).toBe(false)
    expect(disabled.getAttribute('data-disabled')).toBe('')
    expect((disabled.firstElementChild as HTMLElement).getAttribute('data-disabled')).toBe('')
    expect(disabledInput.disabled).toBe(true)
    expect(readOnly.getAttribute('aria-readonly')).toBe('true')
    expect(readOnly.getAttribute('data-readonly')).toBe('')

    await act(() => disabled.click())
    await act(() => key(disabled, 'keyup', ' '))
    await act(() => readOnly.click())
    await act(() => readOnlyInput.click())

    expect(changes).toEqual([])
    expect(disabled.getAttribute('aria-checked')).toBe('true')
    expect(readOnly.getAttribute('aria-checked')).toBe('true')
    expect(readOnlyInput.checked).toBe(true)
  })

  it('disables a button host natively', (t) => {
    let { $, cleanup } = render(
      <checkbox.Context disabled>
        <button aria-label="Accept" mix={checkbox.root()} />
      </checkbox.Context>,
    )
    t.after(cleanup)

    let control = $('button') as HTMLButtonElement
    expect(control.disabled).toBe(true)
    expect(control.hasAttribute('aria-disabled')).toBe(false)
  })

  it('marks required checkboxes and validates the hidden input', (t) => {
    let { $, container, cleanup } = render(
      <form>
        <checkbox.Context required name="terms">
          <span aria-label="Accept" mix={checkbox.root()} />
        </checkbox.Context>
      </form>,
    )
    t.after(cleanup)

    let control = $('[role="checkbox"]') as HTMLElement
    expect(control.getAttribute('aria-required')).toBe('true')
    expect(control.getAttribute('data-required')).toBe('')
    expect(getHiddenInput(container).required).toBe(true)
    expect((container.querySelector('form') as HTMLFormElement).checkValidity()).toBe(false)
  })

  it('participates in forms with name, value, form, and uncheckedValue', async (t) => {
    let { $, $$, act, container, cleanup } = render(
      <div>
        <form id="settings" />
        <checkbox.Context name="newsletter" value="weekly" form="settings">
          <span aria-label="Newsletter" mix={checkbox.root()} />
        </checkbox.Context>
        <checkbox.Context name="marketing" value="yes" uncheckedValue="no" form="settings">
          <span aria-label="Marketing" mix={checkbox.root()} />
        </checkbox.Context>
        <checkbox.Context name="plain" defaultChecked form="settings">
          <span aria-label="Plain" mix={checkbox.root()} />
        </checkbox.Context>
      </div>,
    )
    t.after(cleanup)

    let form = $('#settings') as HTMLFormElement
    let entries = () => [...new FormData(form).entries()]
    expect(entries()).toEqual([
      ['marketing', 'no'],
      ['plain', 'on'],
    ])

    let [newsletter, marketing] = [...$$('[role="checkbox"]')] as HTMLElement[]
    await act(() => newsletter.click())
    await act(() => marketing.click())
    expect(entries()).toEqual([
      ['newsletter', 'weekly'],
      ['marketing', 'yes'],
      ['plain', 'on'],
    ])
    expect(container.querySelectorAll('input[type="hidden"]').length).toBe(0)
  })

  it('fires native change events on the hidden input for form listeners', async (t) => {
    let nativeChanges: boolean[] = []
    let { $, act, cleanup } = render(
      <form
        mix={on('change', (event) => {
          nativeChanges.push((event.target as HTMLInputElement).checked)
        })}
      >
        <checkbox.Context name="terms">
          <span aria-label="Accept" mix={checkbox.root()} />
        </checkbox.Context>
      </form>,
    )
    t.after(cleanup)

    await act(() => ($('[role="checkbox"]') as HTMLElement).click())
    expect(nativeChanges).toEqual([true])
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
        <checkbox.Context>
          <button aria-label="Accept" mix={checkbox.root()} />
        </checkbox.Context>
      </form>,
    )
    t.after(cleanup)

    await act(() => ($('button') as HTMLElement).click())
    expect(submits).toBe(0)
    expect(($('button') as HTMLElement).getAttribute('aria-checked')).toBe('true')
  })

  it('toggles once when a wrapping label is clicked, and names the span root', async (t) => {
    let changes: boolean[] = []
    let { $, act, cleanup } = render(
      <label id="terms-label">
        <checkbox.Context onCheckedChange={(next) => void changes.push(next)}>
          <span mix={checkbox.root()} />
        </checkbox.Context>
        Accept terms
      </label>,
    )
    t.after(cleanup)
    await act(() => Promise.resolve())

    let control = $('[role="checkbox"]') as HTMLElement
    expect(control.getAttribute('aria-labelledby')).toBe('terms-label')

    await act(() => ($('label') as HTMLElement).click())
    expect(changes).toEqual([true])

    await act(() => control.click())
    expect(changes).toEqual([true, false])
  })

  it('supports sibling labels through the hidden input id', async (t) => {
    let changes: boolean[] = []
    let { $, act, cleanup } = render(
      <div>
        <label for="terms">Accept terms</label>
        <checkbox.Context id="terms" onCheckedChange={(next) => void changes.push(next)}>
          <span mix={checkbox.root()} />
        </checkbox.Context>
      </div>,
    )
    t.after(cleanup)
    await act(() => Promise.resolve())

    let label = $('label') as HTMLLabelElement
    let control = $('[role="checkbox"]') as HTMLElement
    expect(label.id).not.toBe('')
    expect(control.getAttribute('aria-labelledby')).toBe(label.id)

    await act(() => label.click())
    expect(changes).toEqual([true])
  })

  it('redirects focus from the hidden input to the root', (t) => {
    let { $, container, cleanup } = render(
      <checkbox.Context>
        <span aria-label="Accept" mix={checkbox.root()} />
      </checkbox.Context>,
    )
    t.after(cleanup)

    getHiddenInput(container).focus()
    expect(document.activeElement).toBe($('[role="checkbox"]'))
  })

  it('lets explicit host props win', (t) => {
    let { $, cleanup } = render(
      <checkbox.Context>
        <span aria-label="Accept" tabIndex={-1} aria-checked="true" mix={checkbox.root()} />
      </checkbox.Context>,
    )
    t.after(cleanup)

    let control = $('[role="checkbox"]') as HTMLElement
    expect(control.tabIndex).toBe(-1)
    expect(control.getAttribute('aria-checked')).toBe('true')
  })

  it('exposes state through the Context value', async (t) => {
    let seen: checkbox.CheckboxContextValue[] = []
    function Probe(handle: Handle) {
      return () => {
        let value = handle.context.get(checkbox.Context)
        seen.push({ ...value })
        return null
      }
    }

    let { cleanup } = render(
      <checkbox.Context defaultChecked readOnly required>
        <span aria-label="Accept" mix={checkbox.root()} />
        <Probe />
      </checkbox.Context>,
    )
    t.after(cleanup)

    let last = seen[seen.length - 1]!
    expect(last.checked).toBe(true)
    expect(last.indeterminate).toBe(false)
    expect(last.readOnly).toBe(true)
    expect(last.required).toBe(true)
    expect(last.disabled).toBe(false)
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

    root.render(<span mix={checkbox.root()} />)
    root.flush()

    expect(String(errors[0])).toMatch(/checkbox\.root\(\) must be rendered inside/)
  })
})

function submit(formNode: Element) {
  formNode.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
}

describe('checkbox in a field', () => {
  it('is labelled, described and named by the field', async (t) => {
    let { $, act, cleanup } = render(
      <field.Context name="terms">
        <label mix={field.label()}>Accept</label>
        <checkbox.Context value="yes">
          <span mix={checkbox.root()}>
            <span mix={checkbox.indicator()} />
          </span>
        </checkbox.Context>
        <p mix={field.description()}>Read them first</p>
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let label = $('label') as HTMLLabelElement
    let control = $('[role="checkbox"]') as HTMLElement
    let input = $('input') as HTMLInputElement
    expect(label.htmlFor).toBe(input.id)
    expect(input.name).toBe('terms')
    expect(control.getAttribute('aria-labelledby')).toBe(label.id)
    expect(control.getAttribute('aria-describedby')).toBe($('p')!.id)

    await act(() => label.click())
    expect(control.getAttribute('aria-checked')).toBe('true')
    expect(control.hasAttribute('data-filled')).toBe(true)
    expect(control.hasAttribute('data-dirty')).toBe(true)
  })

  it('blocks an invalid submission, focuses the root and clears on change', async (t) => {
    let submitted: form.FormValues[] = []
    let { $, act, cleanup } = render(
      <form.Context onFormSubmit={(values) => void submitted.push(values)}>
        <form mix={form.root()}>
          <field.Context name="terms">
            <checkbox.Context required>
              <span aria-label="Accept" mix={checkbox.root()}>
                <span mix={checkbox.indicator({ keepMounted: true })} />
              </span>
            </checkbox.Context>
            <div id="error" mix={field.error()}>
              Required
            </div>
          </field.Context>
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    let control = $('[role="checkbox"]') as HTMLElement
    let indicator = $('[role="checkbox"] > span') as HTMLElement
    await act(() => submit($('form')!))
    expect(submitted).toEqual([])
    expect(document.activeElement).toBe(control)
    expect(control.getAttribute('aria-invalid')).toBe('true')
    expect(control.getAttribute('aria-describedby')).toBe('error')
    expect(indicator.hasAttribute('data-invalid')).toBe(true)

    await act(() => control.click())
    expect(control.hasAttribute('data-valid')).toBe(true)
    await act(() => submit($('form')!))
    expect(submitted).toEqual([{ terms: true }])
  })

  it('shows server errors until the value changes', async (t) => {
    let { $, act, cleanup } = render(
      <form.Context errors={{ terms: 'Rejected' }}>
        <field.Context name="terms">
          <checkbox.Context>
            <span aria-label="Accept" mix={checkbox.root()} />
          </checkbox.Context>
        </field.Context>
      </form.Context>,
    )
    t.after(cleanup)
    let control = $('[role="checkbox"]') as HTMLElement
    expect(control.getAttribute('aria-invalid')).toBe('true')
    await act(() => control.click())
    expect(control.hasAttribute('aria-invalid')).toBe(false)
  })

  it('is disabled by the field or an enclosing fieldset', (t) => {
    let { $$, cleanup } = render(
      <div>
        <field.Context disabled>
          <checkbox.Context>
            <span aria-label="A" mix={checkbox.root()} />
          </checkbox.Context>
        </field.Context>
        <fieldset.Context disabled>
          <checkbox.Context>
            <span aria-label="B" mix={checkbox.root()} />
          </checkbox.Context>
        </fieldset.Context>
      </div>,
    )
    t.after(cleanup)
    for (let control of [...$$('[role="checkbox"]')] as HTMLElement[]) {
      expect(control.getAttribute('aria-disabled')).toBe('true')
      expect(control.hasAttribute('data-disabled')).toBe(true)
    }
    for (let input of [...$$('input')] as HTMLInputElement[]) expect(input.disabled).toBe(true)
  })
})

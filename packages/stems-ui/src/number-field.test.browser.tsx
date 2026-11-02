import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { on, type Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as numberField from './number-field.ts'
import * as field from './field.ts'
import * as fieldset from './fieldset.ts'
import * as form from './form.ts'

function key(target: Element, value: string, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value, ...init })
  target.dispatchEvent(event)
  return event
}

function type(input: HTMLInputElement, text: string) {
  input.value = text
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
}

function blur(input: HTMLInputElement) {
  input.dispatchEvent(new FocusEvent('blur'))
  input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
}

function pointer(target: Element, type: string, init: PointerEventInit = {}) {
  let event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type FieldProps = numberField.NumberFieldContextProps & { scrub?: boolean }

function Field(handle: Handle<FieldProps>) {
  return () => {
    let { scrub, ...props } = handle.props
    return (
      <numberField.Context {...props}>
        <div mix={numberField.root()}>
          {scrub ? (
            <span id="scrub" mix={numberField.scrubArea({ pixelSensitivity: 2 })}>
              Amount
              <span id="cursor" mix={numberField.scrubAreaCursor()} />
            </span>
          ) : null}
          <div mix={numberField.group()}>
            <button id="dec" mix={numberField.decrement()} />
            <input aria-label="Amount" mix={numberField.input()} />
            <button id="inc" mix={numberField.increment()} />
          </div>
        </div>
      </numberField.Context>
    )
  }
}

function parts(container: Element) {
  return {
    input: container.querySelector('input[aria-label="Amount"]') as HTMLInputElement,
    hidden: container.querySelector('input[type="number"]') as HTMLInputElement,
    inc: container.querySelector('#inc') as HTMLButtonElement,
    dec: container.querySelector('#dec') as HTMLButtonElement,
    group: container.querySelector('[role="group"]') as HTMLElement,
  }
}

describe('number-field', () => {
  it('renders the input, group, buttons, and hidden input', (t) => {
    let { container, cleanup } = render(
      <Field defaultValue={1234.5} name="amount" min={0} max={10000} locale="en-US" />,
    )
    t.after(cleanup)
    let { input, hidden, inc, dec, group } = parts(container)

    expect(input.type).toBe('text')
    expect(input.value).toBe('1,234.5')
    expect(input.getAttribute('inputmode')).toBe('decimal')
    expect(input.getAttribute('aria-roledescription')).toBe('Number field')
    expect(input.getAttribute('autocomplete')).toBe('off')
    expect(input.id).not.toBe('')
    expect(group.getAttribute('role')).toBe('group')
    expect(inc.type).toBe('button')
    expect(inc.tabIndex).toBe(-1)
    expect(inc.getAttribute('aria-label')).toBe('Increase')
    expect(dec.getAttribute('aria-label')).toBe('Decrease')
    expect(inc.getAttribute('aria-controls')).toBe(input.id)
    expect(hidden.name).toBe('amount')
    expect(hidden.value).toBe('1234.5')
    expect(hidden.min).toBe('0')
    expect(hidden.max).toBe('10000')
    expect(hidden.step).toBe('1')
    expect(hidden.getAttribute('aria-hidden')).toBe('true')
    expect(hidden.tabIndex).toBe(-1)
  })

  it('uses inputmode text when negative values are allowed', (t) => {
    let { container, cleanup } = render(<Field />)
    t.after(cleanup)
    expect(parts(container).input.getAttribute('inputmode')).toBe('text')
    expect(parts(container).hidden.step).toBe('any')
  })

  it('parses typing, commits on blur with clamping and formatting', async (t) => {
    let changes: Array<[number | null, string]> = []
    let commits: Array<[number | null, string]> = []
    let { act, container, cleanup } = render(
      <Field
        defaultValue={5}
        min={0}
        max={100}
        locale="en-US"
        onValueChange={(value, details) => void changes.push([value, details.reason])}
        onValueCommitted={(value, details) => void commits.push([value, details.reason])}
      />,
    )
    t.after(cleanup)
    let { input, hidden } = parts(container)

    await act(() => type(input, '1,50'))
    expect(input.value).toBe('1,50')
    expect(hidden.value).toBe('150')
    expect(changes).toEqual([[150, 'input-change']])
    expect(commits).toEqual([])

    await act(() => blur(input))
    expect(input.value).toBe('100')
    expect(changes.at(-1)).toEqual([100, 'input-blur'])
    expect(commits).toEqual([[100, 'input-blur']])

    await act(() => type(input, ''))
    expect(changes.at(-1)).toEqual([null, 'input-clear'])
    await act(() => blur(input))
    expect(input.value).toBe('')
    expect(commits.at(-1)).toEqual([null, 'input-clear'])

    // Unparseable text reverts to the last valid value on blur.
    await act(() => type(input, '42'))
    await act(() => type(input, '42-'))
    await act(() => blur(input))
    expect(input.value).toBe('42')
  })

  it('keeps out-of-range typed values with allowOutOfRange', async (t) => {
    let { act, container, cleanup } = render(<Field defaultValue={5} max={10} allowOutOfRange />)
    t.after(cleanup)
    let { input, hidden } = parts(container)
    await act(() => type(input, '50'))
    await act(() => blur(input))
    expect(input.value).toBe('50')
    expect(hidden.value).toBe('50')
    expect(hidden.validity.rangeOverflow).toBe(true)
  })

  it('steps with arrows (Shift = large, Alt = small), PageUp/Down, Home/End, and commits', async (t) => {
    let commits: Array<[number | null, string]> = []
    let { act, container, cleanup } = render(
      <Field
        defaultValue={10}
        min={0}
        max={50}
        locale="en-US"
        onValueCommitted={(value, details) => void commits.push([value, details.reason])}
      />,
    )
    t.after(cleanup)
    let { input } = parts(container)

    let event: KeyboardEvent | undefined
    await act(() => {
      event = key(input, 'ArrowUp')
    })
    expect(event!.defaultPrevented).toBe(true)
    expect(input.value).toBe('11')
    await act(() => key(input, 'ArrowUp', { shiftKey: true }))
    expect(input.value).toBe('21')
    await act(() => key(input, 'ArrowDown', { altKey: true }))
    expect(input.value).toBe('20.9')
    await act(() => key(input, 'PageUp'))
    expect(input.value).toBe('30.9')
    await act(() => key(input, 'PageDown'))
    await act(() => key(input, 'ArrowDown'))
    expect(input.value).toBe('19.9')
    await act(() => key(input, 'End'))
    expect(input.value).toBe('50')
    await act(() => key(input, 'ArrowUp'))
    expect(input.value).toBe('50')
    await act(() => key(input, 'Home'))
    expect(input.value).toBe('0')
    expect(commits.map(([value]) => value)).toEqual([11, 21, 20.9, 30.9, 20.9, 19.9, 50, 50, 0])
    expect(commits.every(([, reason]) => reason === 'keyboard')).toBe(true)
  })

  it('commits typed text on Enter', async (t) => {
    let commits: Array<number | null> = []
    let { act, container, cleanup } = render(
      <Field max={10} onValueCommitted={(value) => void commits.push(value)} />,
    )
    t.after(cleanup)
    let { input } = parts(container)
    await act(() => type(input, '12'))
    await act(() => key(input, 'Enter'))
    expect(input.value).toBe('10')
    expect(commits).toEqual([10])
  })

  it('blocks characters that cannot be part of a number', (t) => {
    let { container, cleanup } = render(<Field locale="en-US" />)
    t.after(cleanup)
    let { input } = parts(container)
    expect(key(input, 'a').defaultPrevented).toBe(true)
    expect(key(input, '5').defaultPrevented).toBe(false)
    expect(key(input, '.').defaultPrevented).toBe(false)
    expect(key(input, '-').defaultPrevented).toBe(false)
    expect(key(input, 'a', { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(key(input, 'Backspace').defaultPrevented).toBe(false)
  })

  it('accepts numeric pastes and rejects others', async (t) => {
    let changes: Array<[number | null, string]> = []
    let { act, container, cleanup } = render(
      <Field
        locale="en-US"
        onValueChange={(value, details) => void changes.push([value, details.reason])}
      />,
    )
    t.after(cleanup)
    let { input } = parts(container)

    function paste(text: string) {
      let data = new DataTransfer()
      data.setData('text/plain', text)
      let event = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      })
      // Firefox copies `clipboardData` from the init dictionary into a new, empty DataTransfer
      // for script-created events (real pastes carry the clipboard). Expose the populated one.
      if (event.clipboardData?.getData('text/plain') !== text) {
        Object.defineProperty(event, 'clipboardData', { value: data })
      }
      input.dispatchEvent(event)
      return event
    }

    await act(() => paste('hello'))
    expect(input.value).toBe('')
    expect(changes).toEqual([])
    await act(() => paste(' 1,234.5 '))
    expect(input.value).toBe('1,234.5')
    expect(changes).toEqual([[1234.5, 'input-paste']])
  })

  it('formats and parses with the locale and format', async (t) => {
    let values: Array<number | null> = []
    let { act, container, cleanup } = render(
      <Field defaultValue={1234.5} locale="de-DE" onValueChange={(v) => void values.push(v)} />,
    )
    t.after(cleanup)
    let { input } = parts(container)
    expect(input.value).toBe('1.234,5')
    await act(() => type(input, '2.345,6'))
    expect(values).toEqual([2345.6])
    await act(() => blur(input))
    expect(input.value).toBe('2.345,6')

    let percent = render(
      <Field defaultValue={0.25} format={{ style: 'percent' }} step={0.01} locale="en-US" />,
    )
    t.after(percent.cleanup)
    let percentInput = parts(percent.container).input
    expect(percentInput.value).toBe('25%')
    await percent.act(() => type(percentInput, '50'))
    await percent.act(() => blur(percentInput))
    expect(percentInput.value).toBe('50%')
    expect(parts(percent.container).hidden.value).toBe('0.5')
    await percent.act(() => key(percentInput, 'ArrowUp'))
    expect(percentInput.value).toBe('51%')

    let currency = render(
      <Field
        defaultValue={9.5}
        format={{ style: 'currency', currency: 'EUR' }}
        locale="en-US"
        onValueChange={(v) => void values.push(v)}
      />,
    )
    t.after(currency.cleanup)
    let currencyInput = parts(currency.container).input
    expect(currencyInput.value).toBe('€9.50')
    await currency.act(() => type(currencyInput, '€12.25'))
    expect(values.at(-1)).toBe(12.25)
  })

  it('steps with the increment and decrement buttons and disables them at the limits', async (t) => {
    let commits: Array<[number | null, string]> = []
    let { act, container, cleanup } = render(
      <Field
        defaultValue={9}
        min={8}
        max={10}
        onValueCommitted={(value, details) => void commits.push([value, details.reason])}
      />,
    )
    t.after(cleanup)
    let { input, inc, dec } = parts(container)

    await act(() => inc.click())
    expect(input.value).toBe('10')
    expect(inc.disabled).toBe(true)
    expect(inc.hasAttribute('data-disabled')).toBe(true)
    await act(() => dec.click())
    await act(() => dec.click())
    expect(input.value).toBe('8')
    expect(dec.disabled).toBe(true)
    expect(commits).toEqual([
      [10, 'increment-press'],
      [9, 'decrement-press'],
      [8, 'decrement-press'],
    ])
  })

  it('repeats while a stepper button is held and commits once on release', async (t) => {
    let commits: Array<number | null> = []
    let changes: string[] = []
    let { act, container, cleanup } = render(
      <Field
        defaultValue={0}
        onValueChange={(_value, details) => void changes.push(details.reason)}
        onValueCommitted={(value) => void commits.push(value)}
      />,
    )
    t.after(cleanup)
    let { input, inc } = parts(container)

    let down: PointerEvent | undefined
    await act(() => {
      down = pointer(inc, 'pointerdown')
    })
    expect(input.value).toBe('1')
    let mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    inc.dispatchEvent(mousedown)
    expect(mousedown.defaultPrevented).toBe(true)
    await act(() => wait(600))
    await act(() => pointer(inc, 'pointerup'))
    // The click that follows a pointer press doesn't step again.
    await act(() => inc.click())
    let held = Number(input.value)
    expect(held > 2).toBe(true)
    await act(() => wait(150))
    expect(Number(input.value)).toBe(held)
    expect(commits).toEqual([held])
    expect(changes.every((reason) => reason === 'increment-press')).toBe(true)
    expect(down!.defaultPrevented).toBe(false)
  })

  it('snaps to the step with snapOnStep', async (t) => {
    let { act, container, cleanup } = render(<Field defaultValue={1.3} snapOnStep />)
    t.after(cleanup)
    let { input, inc, dec } = parts(container)
    await act(() => inc.click())
    expect(input.value).toBe('2')
    await act(() => key(input, 'ArrowDown'))
    expect(input.value).toBe('1')
    await act(() => key(input, 'ArrowUp', { altKey: true }))
    expect(input.value).toBe('1.1')
    await act(() => dec.click())
    expect(input.value).toBe('1')
    await act(() => dec.click())
    expect(input.value).toBe('0')
  })

  it('changes the value with the mouse wheel when allowWheelScrub is set', async (t) => {
    let commits: Array<[number | null, string]> = []
    let { act, container, cleanup } = render(
      <Field
        defaultValue={5}
        allowWheelScrub
        onValueCommitted={(value, details) => void commits.push([value, details.reason])}
      />,
    )
    t.after(cleanup)
    let { input } = parts(container)
    function wheel(deltaY: number) {
      let event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY })
      input.dispatchEvent(event)
      return event
    }
    // Not focused: ignored.
    expect(wheel(-100).defaultPrevented).toBe(false)
    input.focus()
    input.dispatchEvent(new PointerEvent('pointerenter'))
    let event: WheelEvent | undefined
    await act(() => {
      event = wheel(-100)
    })
    expect(event!.defaultPrevented).toBe(true)
    expect(input.value).toBe('6')
    await act(() => wheel(100))
    await act(() => wheel(100))
    expect(input.value).toBe('4')
    expect(commits.at(-1)).toEqual([4, 'wheel'])
  })

  it('scrubs the value by dragging the scrub area', async (t) => {
    let commits: Array<[number | null, string]> = []
    let { act, container, cleanup } = render(
      <Field
        scrub
        defaultValue={10}
        onValueCommitted={(value, details) => void commits.push([value, details.reason])}
      />,
    )
    t.after(cleanup)
    let { input } = parts(container)
    let area = container.querySelector('#scrub') as HTMLElement
    let cursor = container.querySelector('#cursor') as HTMLElement
    let root = container.firstElementChild as HTMLElement
    expect(cursor.hidden).toBe(true)
    expect(area.style.touchAction).toBe('none')

    await act(() =>
      pointer(area, 'pointerdown', { clientX: 50, clientY: 50, pointerType: 'touch' }),
    )
    expect(root.hasAttribute('data-scrubbing')).toBe(true)
    expect(area.hasAttribute('data-scrubbing')).toBe(true)
    await act(() => pointer(area, 'pointermove', { movementX: 6, pointerType: 'touch' }))
    expect(input.value).toBe('13')
    await act(() => pointer(area, 'pointermove', { movementX: -3, pointerType: 'touch' }))
    expect(input.value).toBe('12')
    await act(() => pointer(area, 'pointerup', { pointerType: 'touch' }))
    expect(root.hasAttribute('data-scrubbing')).toBe(false)
    expect(commits).toEqual([[12, 'scrub']])
  })

  it('falls back to pointer capture when the pointer lock is refused', async (t) => {
    let { act, container, cleanup } = render(<Field scrub defaultValue={10} />)
    t.after(cleanup)
    let { input } = parts(container)
    let area = container.querySelector('#scrub') as HTMLElement
    let cursor = container.querySelector('#cursor') as HTMLElement
    let captured: number[] = []
    area.setPointerCapture = (id: number) => void captured.push(id)
    area.hasPointerCapture = () => false

    // A rejected promise (current engines).
    area.requestPointerLock = () =>
      Promise.reject(new DOMException('refused', 'NotAllowedError')) as never
    await act(() => pointer(area, 'pointerdown', { clientX: 50, clientY: 50 }))
    await act(() => wait(0))
    expect(captured).toEqual([1])
    expect(cursor.hidden).toBe(true)
    await act(() => pointer(area, 'pointermove', { movementX: 4 }))
    expect(input.value).toBe('12')
    await act(() => pointer(area, 'pointerup'))

    // `undefined` plus a `pointerlockerror` event (engines without the promise).
    captured = []
    area.requestPointerLock = (() => {
      queueMicrotask(() => document.dispatchEvent(new Event('pointerlockerror')))
    }) as never
    await act(() => pointer(area, 'pointerdown', { clientX: 50, clientY: 50 }))
    await act(() => wait(0))
    expect(captured).toEqual([1])
    expect(cursor.hidden).toBe(true)
    await act(() => pointer(area, 'pointerup'))
    expect(input.value).toBe('12')
  })

  it('supports controlled values and cancel()', async (t) => {
    let seen: Array<number | null> = []
    function Controlled(handle: Handle) {
      let value: number | null = 1
      return () => (
        <div>
          <Field
            value={value}
            onValueChange={(next, details) => {
              seen.push(next)
              if (next !== null && next > 2) {
                details.cancel()
                return
              }
              value = next
              void handle.update()
            }}
          />
          <button
            id="external"
            mix={on('click', () => {
              value = null
              void handle.update()
            })}
          />
        </div>
      )
    }
    let { $, act, container, cleanup } = render(<Controlled />)
    t.after(cleanup)
    let { input, inc } = parts(container)
    await act(() => inc.click())
    expect(input.value).toBe('2')
    await act(() => inc.click())
    expect(input.value).toBe('2')
    expect(seen).toEqual([2, 3])
    await act(() => ($('#external') as HTMLElement).click())
    expect(input.value).toBe('')
  })

  it('participates in forms and dispatches bubbling events', async (t) => {
    let changes: numberField.NumberFieldChangeEvent[] = []
    let commits: numberField.NumberFieldCommitEvent[] = []
    let { act, container, cleanup } = render(
      <form
        mix={[
          numberField.onNumberFieldChange((event) => void changes.push(event)),
          numberField.onNumberFieldCommit((event) => void commits.push(event)),
        ]}
      >
        <Field name="qty" defaultValue={3} required />
      </form>,
    )
    t.after(cleanup)
    let form = container.querySelector('form')!
    let { input, hidden } = parts(container)
    expect(new FormData(form).get('qty')).toBe('3')
    await act(() => key(input, 'ArrowUp'))
    expect(new FormData(form).get('qty')).toBe('4')
    expect(changes[0]).toBeInstanceOf(numberField.NumberFieldChangeEvent)
    expect(changes[0].value).toBe(4)
    expect(changes[0].reason).toBe('keyboard')
    expect(commits[0].value).toBe(4)
    expect(hidden.required).toBe(true)
    await act(() => type(input, ''))
    expect(hidden.validity.valueMissing).toBe(true)
    expect(form.checkValidity()).toBe(false)
  })

  it('ignores interaction when disabled or read-only', async (t) => {
    let changes: unknown[] = []
    let disabled = render(
      <Field defaultValue={1} disabled onValueChange={(v) => void changes.push(v)} />,
    )
    t.after(disabled.cleanup)
    let d = parts(disabled.container)
    expect(d.input.disabled).toBe(true)
    expect(d.inc.disabled).toBe(true)
    expect(d.hidden.disabled).toBe(true)
    expect(d.group.hasAttribute('data-disabled')).toBe(true)

    let readOnly = render(
      <Field defaultValue={1} readOnly onValueChange={(v) => void changes.push(v)} />,
    )
    t.after(readOnly.cleanup)
    let r = parts(readOnly.container)
    expect(r.input.readOnly).toBe(true)
    expect(r.input.hasAttribute('data-readonly')).toBe(true)
    await readOnly.act(() => key(r.input, 'ArrowUp'))
    await readOnly.act(() => r.inc.click())
    expect(r.input.value).toBe('1')
    expect(changes).toEqual([])
  })

  it('accepts every mixin called with no arguments', (t) => {
    let { container, cleanup } = render(
      <numberField.Context>
        <div mix={numberField.root()}>
          <span mix={numberField.scrubArea()}>
            <span mix={numberField.scrubAreaCursor()} />
          </span>
          <div mix={numberField.group()}>
            <button mix={numberField.decrement()} />
            <input mix={numberField.input()} />
            <button mix={numberField.increment()} />
          </div>
        </div>
      </numberField.Context>,
    )
    t.after(cleanup)
    expect(container.querySelectorAll('input').length).toBe(2)
  })
})

function submitForm(formNode: Element) {
  formNode.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
}

function FieldNumber(handle: Handle<numberField.NumberFieldContextProps>) {
  return () => (
    <numberField.Context {...handle.props}>
      <div id="nf-root" mix={numberField.root()}>
        <div mix={numberField.group()}>
          <button id="nf-dec" mix={numberField.decrement()} />
          <input mix={numberField.input()} />
          <button id="nf-inc" mix={numberField.increment()} />
        </div>
      </div>
    </numberField.Context>
  )
}

describe('number field in a field', () => {
  it('is labelled, described and named by the field', async (t) => {
    let { $, act, container, cleanup } = render(
      <field.Context name="count">
        <label mix={field.label()}>Count</label>
        <FieldNumber name="ignored" defaultValue={3} />
        <p mix={field.description()}>How many</p>
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let input = container.querySelector('input:not([type=number])') as HTMLInputElement
    let hidden = container.querySelector('input[type=number]') as HTMLInputElement
    expect(($('label') as HTMLLabelElement).htmlFor).toBe(input.id)
    expect(($('#nf-inc') as HTMLElement).getAttribute('aria-controls')).toBe(input.id)
    expect(input.getAttribute('aria-describedby')).toBe($('p')!.id)
    expect(hidden.name).toBe('count')
    expect(input.hasAttribute('data-filled')).toBe(true)
    for (let part of [input, $('#nf-root')!, $('#nf-inc')!]) {
      expect(part.hasAttribute('data-filled')).toBe(true)
    }
    await act(() => ($('#nf-inc') as HTMLElement).click())
    expect(input.hasAttribute('data-dirty')).toBe(true)
    expect($('#nf-root')!.hasAttribute('data-dirty')).toBe(true)
  })

  it('blocks a required or out-of-range value and focuses the input', async (t) => {
    let submitted: form.FormValues[] = []
    let { $, act, container, cleanup } = render(
      <form.Context onFormSubmit={(values) => void submitted.push(values)}>
        <form mix={form.root()}>
          <field.Context name="count">
            <FieldNumber required min={1} max={5} allowOutOfRange />
            <div id="missing" mix={field.error({ match: 'valueMissing' })}>
              Required
            </div>
            <div id="over" mix={field.error({ match: 'rangeOverflow' })}>
              Too many
            </div>
          </field.Context>
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    let input = container.querySelector('input:not([type=number])') as HTMLInputElement
    await act(() => submitForm($('form')!))
    expect(submitted).toEqual([])
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe('missing')
    expect($('#nf-root')!.hasAttribute('data-invalid')).toBe(true)

    await act(() => type(input, '9'))
    await act(() => blur(input))
    expect(input.getAttribute('aria-describedby')).toBe('over')
    await act(() => {
      input.focus()
      type(input, '4')
    })
    expect(input.hasAttribute('data-valid')).toBe(true)
    await act(() => blur(input))
    await act(() => submitForm($('form')!))
    expect(submitted).toEqual([{ count: 4 }])
  })

  it('validates on blur after committing the typed text', async (t) => {
    let seen: unknown[] = []
    let { act, container, cleanup } = render(
      <field.Context
        validationMode="onBlur"
        validate={(value) => {
          seen.push(value)
          return value === 2 ? 'Not two' : null
        }}
      >
        <FieldNumber />
      </field.Context>,
    )
    t.after(cleanup)
    let input = container.querySelector('input:not([type=number])') as HTMLInputElement
    await act(() => {
      input.focus()
      type(input, '2')
    })
    expect(input.hasAttribute('data-focused')).toBe(true)
    await act(() => blur(input))
    expect(seen.at(-1)).toBe(2)
    expect(input.hasAttribute('data-touched')).toBe(true)
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('clears server errors on change', async (t) => {
    let { $, act, container, cleanup } = render(
      <form.Context errors={{ count: 'Too many in stock' }}>
        <field.Context name="count">
          <FieldNumber defaultValue={1} />
        </field.Context>
      </form.Context>,
    )
    t.after(cleanup)
    let input = container.querySelector('input:not([type=number])') as HTMLInputElement
    expect(input.getAttribute('aria-invalid')).toBe('true')
    await act(() => ($('#nf-inc') as HTMLElement).click())
    expect(input.hasAttribute('aria-invalid')).toBe(false)
  })

  it('is disabled by the field or an enclosing fieldset', (t) => {
    let { $$, cleanup } = render(
      <div>
        <field.Context disabled>
          <FieldNumber />
        </field.Context>
        <fieldset.Context disabled>
          <FieldNumber />
        </fieldset.Context>
      </div>,
    )
    t.after(cleanup)
    for (let input of [...$$('input')] as HTMLInputElement[]) expect(input.disabled).toBe(true)
    for (let root of [...$$('#nf-root')]) expect(root.hasAttribute('data-disabled')).toBe(true)
  })
})

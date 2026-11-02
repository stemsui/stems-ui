import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { on, type Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as otpField from './otp-field.ts'
import * as field from './field.ts'
import * as fieldset from './fieldset.ts'
import * as form from './form.ts'

function key(target: Element, value: string, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value, ...init })
  target.dispatchEvent(event)
  return event
}

function type(slot: HTMLInputElement, text: string) {
  slot.value = text
  slot.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
  )
}

function paste(slot: HTMLInputElement, text: string) {
  let data = new DataTransfer()
  data.setData('text/plain', text)
  let event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data })
  // Firefox copies `clipboardData` from the init dictionary into a new, empty DataTransfer for
  // script-created events (real pastes carry the clipboard). Expose the populated one.
  if (event.clipboardData?.getData('text/plain') !== text) {
    Object.defineProperty(event, 'clipboardData', { value: data })
  }
  slot.dispatchEvent(event)
  return event
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

type OtpProps = Omit<otpField.OTPFieldContextProps, 'length'> & { length?: number }

function Otp(handle: Handle<OtpProps>) {
  return () => {
    let { length = 4, ...props } = handle.props
    return (
      <otpField.Context length={length} {...props}>
        <div mix={otpField.root()}>
          {Array.from({ length }, (_, index) => (
            <input
              aria-label={index === 0 ? undefined : `Character ${index + 1}`}
              mix={otpField.input()}
            />
          ))}
        </div>
      </otpField.Context>
    )
  }
}

function slotsOf(container: Element) {
  return [...container.querySelectorAll('[role="group"] input')] as HTMLInputElement[]
}

function hiddenOf(container: Element) {
  return container.querySelector('input[aria-hidden="true"]') as HTMLInputElement
}

describe('otp-field', () => {
  it('renders slots with ids, input hints, roving tab stop, and a hidden input', (t) => {
    let { container, cleanup } = render(<Otp id="code" defaultValue="12" name="otp" required />)
    t.after(cleanup)
    let slots = slotsOf(container)
    let hidden = hiddenOf(container)
    let root = container.querySelector('[role="group"]') as HTMLElement

    expect(slots.map((slot) => slot.id)).toEqual(['code', 'code-2', 'code-3', 'code-4'])
    expect(slots.map((slot) => slot.value)).toEqual(['1', '2', '', ''])
    expect(slots.map((slot) => slot.tabIndex)).toEqual([-1, -1, 0, -1])
    expect(slots[0].getAttribute('autocomplete')).toBe('one-time-code')
    expect(slots[1].getAttribute('autocomplete')).toBe('off')
    expect(slots[0].getAttribute('inputmode')).toBe('numeric')
    expect(slots[0].type).toBe('text')
    expect(slots[0].hasAttribute('data-filled')).toBe(true)
    expect(slots[2].hasAttribute('data-filled')).toBe(false)
    expect(root.hasAttribute('data-filled')).toBe(true)
    expect(root.hasAttribute('data-complete')).toBe(false)
    expect(root.hasAttribute('data-required')).toBe(true)
    expect(hidden.name).toBe('otp')
    expect(hidden.value).toBe('12')
    expect(hidden.required).toBe(true)
    expect(hidden.tabIndex).toBe(-1)
    expect(hidden.validity.patternMismatch).toBe(true)
  })

  it('advances on typing and completes', async (t) => {
    let changes: Array<[string, string]> = []
    let completes: string[] = []
    let { act, container, cleanup } = render(
      <Otp
        onValueChange={(value, details) => void changes.push([value, details.reason])}
        onValueComplete={(value) => void completes.push(value)}
      />,
    )
    t.after(cleanup)
    let slots = slotsOf(container)
    let root = container.querySelector('[role="group"]') as HTMLElement

    await act(() => slots[0].focus())
    expect(root.hasAttribute('data-focused')).toBe(true)
    await act(() => type(slots[0], '1'))
    await act(tick)
    expect(document.activeElement).toBe(slots[1])
    await act(() => type(slots[1], '2'))
    await act(() => type(slots[2], '3'))
    await act(() => type(slots[3], '4'))
    await act(tick)
    expect(slots.map((slot) => slot.value)).toEqual(['1', '2', '3', '4'])
    expect(changes.map(([value]) => value)).toEqual(['1', '12', '123', '1234'])
    expect(changes.every(([, reason]) => reason === 'input-change')).toBe(true)
    expect(completes).toEqual(['1234'])
    expect(root.hasAttribute('data-complete')).toBe(true)
    expect(slots[3].hasAttribute('data-complete')).toBe(true)
    expect(hiddenOf(container).value).toBe('1234')
    expect(hiddenOf(container).validity.valid).toBe(true)
    expect(document.activeElement).toBe(slots[3])
  })

  it('rejects characters outside validationType and reports them', async (t) => {
    let invalid: string[] = []
    let { act, container, cleanup } = render(
      <Otp onValueInvalid={(value) => void invalid.push(value)} />,
    )
    t.after(cleanup)
    let slots = slotsOf(container)
    await act(() => slots[0].focus())
    await act(() => type(slots[0], 'a'))
    expect(slots[0].value).toBe('')
    expect(invalid).toEqual(['a'])
  })

  it('accepts alphanumeric codes, normalizes, and masks', async (t) => {
    let { act, container, cleanup } = render(
      <Otp validationType="alphanumeric" normalizeValue={(v) => v.toUpperCase()} mask />,
    )
    t.after(cleanup)
    let slots = slotsOf(container)
    expect(slots[0].type).toBe('password')
    expect(slots[0].getAttribute('inputmode')).toBe('text')
    await act(() => slots[0].focus())
    await act(() => type(slots[0], 'a'))
    await act(() => type(slots[1], '7'))
    expect(hiddenOf(container).value).toBe('A7')
  })

  it('replaces a filled slot when typing next to its character', async (t) => {
    let { act, container, cleanup } = render(<Otp defaultValue="123" />)
    t.after(cleanup)
    let slots = slotsOf(container)
    await act(() => slots[1].focus())
    await act(() => type(slots[1], '29'))
    await act(tick)
    expect(slots.map((slot) => slot.value)).toEqual(['1', '9', '3', ''])
    expect(document.activeElement).toBe(slots[2])
  })

  it('distributes autofilled codes typed into one slot', async (t) => {
    let completes: string[] = []
    let { act, container, cleanup } = render(
      <Otp onValueComplete={(value) => void completes.push(value)} />,
    )
    t.after(cleanup)
    let slots = slotsOf(container)
    await act(() => slots[0].focus())
    await act(() => type(slots[0], '9876'))
    await act(tick)
    expect(slots.map((slot) => slot.value)).toEqual(['9', '8', '7', '6'])
    expect(completes).toEqual(['9876'])
  })

  it('fills all slots on paste, ignoring whitespace', async (t) => {
    let changes: Array<[string, string]> = []
    let completes: string[] = []
    let invalid: string[] = []
    let { act, container, cleanup } = render(
      <Otp
        defaultValue="1"
        onValueChange={(value, details) => void changes.push([value, details.reason])}
        onValueComplete={(value) => void completes.push(value)}
        onValueInvalid={(value) => void invalid.push(value)}
      />,
    )
    t.after(cleanup)
    let slots = slotsOf(container)
    await act(() => slots[1].focus())
    let event: ClipboardEvent | undefined
    await act(() => {
      event = paste(slots[1], ' 4 3 2 1 ')
    })
    await act(tick)
    expect(event!.defaultPrevented).toBe(true)
    expect(slots.map((slot) => slot.value)).toEqual(['4', '3', '2', '1'])
    expect(changes).toEqual([['4321', 'input-paste']])
    expect(completes).toEqual(['4321'])
    expect(invalid).toEqual([])
    expect(document.activeElement).toBe(slots[3])

    // Pasting the same complete code again reports completion without a change.
    await act(() => paste(slots[3], '4321'))
    expect(changes.length).toBe(1)
    expect(completes).toEqual(['4321', '4321'])

    // Partial pastes insert at the focused slot; rejected characters are reported.
    await act(() => key(slots[3], 'Backspace'))
    await act(() => key(slots[3], 'Backspace'))
    await act(tick)
    await act(() => paste(slots[2], '9-'))
    expect(hiddenOf(container).value).toBe('439')
    expect(invalid).toEqual(['9-'])
  })

  it('handles Backspace, Delete, arrows, Home, and End', async (t) => {
    let reasons: string[] = []
    let { act, container, cleanup } = render(
      <Otp defaultValue="123" onValueChange={(_v, details) => void reasons.push(details.reason)} />,
    )
    t.after(cleanup)
    let slots = slotsOf(container)

    await act(() => slots[3].focus())
    expect(document.activeElement).toBe(slots[3])
    // Backspace on an empty slot deletes the previous character and moves back.
    await act(() => key(slots[3], 'Backspace'))
    await act(tick)
    expect(hiddenOf(container).value).toBe('12')
    expect(document.activeElement).toBe(slots[2])

    await act(() => key(slots[2], 'ArrowLeft'))
    expect(document.activeElement).toBe(slots[1])
    await act(() => key(slots[1], 'Home'))
    expect(document.activeElement).toBe(slots[0])
    await act(() => key(slots[0], 'End'))
    expect(document.activeElement).toBe(slots[2])
    await act(() => key(slots[2], 'ArrowRight'))
    expect(document.activeElement).toBe(slots[2])

    // Backspace on a filled slot clears it in place.
    await act(() => key(slots[0], 'ArrowLeft'))
    await act(() => slots[1].focus())
    await act(() => key(slots[1], 'Backspace'))
    await act(tick)
    expect(hiddenOf(container).value).toBe('1')
    expect(document.activeElement).toBe(slots[1])

    await act(() => slots[0].focus())
    await act(() => key(slots[0], 'Delete'))
    await act(tick)
    expect(hiddenOf(container).value).toBe('')
    expect(reasons).toEqual(['keyboard', 'keyboard', 'keyboard'])
  })

  it('moves focus from slots past the first empty one back to it', async (t) => {
    let { act, container, cleanup } = render(<Otp defaultValue="1" />)
    t.after(cleanup)
    let slots = slotsOf(container)
    await act(() => slots[3].focus())
    expect(document.activeElement).toBe(slots[1])
  })

  it('flips arrow keys in RTL', async (t) => {
    let { act, container, cleanup } = render(
      <div dir="rtl">
        <Otp defaultValue="12" />
      </div>,
    )
    t.after(cleanup)
    let slots = slotsOf(container)
    await act(() => slots[1].focus())
    await act(() => key(slots[1], 'ArrowLeft'))
    expect(document.activeElement).toBe(slots[2])
    await act(() => key(slots[2], 'ArrowRight'))
    expect(document.activeElement).toBe(slots[1])
  })

  it('supports controlled values and cancel()', async (t) => {
    let seen: string[] = []
    function Controlled(handle: Handle) {
      let value = '1'
      return () => (
        <div>
          <Otp
            value={value}
            onValueChange={(next, details) => {
              seen.push(next)
              if (next.includes('0')) {
                details.cancel()
                return
              }
              value = next
              void handle.update()
            }}
          />
          <button
            id="reset"
            mix={on('click', () => {
              value = ''
              void handle.update()
            })}
          />
        </div>
      )
    }
    let { $, act, container, cleanup } = render(<Controlled />)
    t.after(cleanup)
    let slots = slotsOf(container)
    await act(() => slots[1].focus())
    await act(() => type(slots[1], '2'))
    await act(tick)
    expect(slots[1].value).toBe('2')
    await act(() => type(slots[2], '0'))
    await act(tick)
    expect(slots[2].value).toBe('')
    expect(seen).toEqual(['12', '120'])
    await act(() => ($('#reset') as HTMLElement).click())
    expect(slots.map((slot) => slot.value)).toEqual(['', '', '', ''])
  })

  it('submits the form on completion with autoSubmit', async (t) => {
    let submitted: string[] = []
    let { act, container, cleanup } = render(
      <form
        mix={on('submit', (event) => {
          event.preventDefault()
          submitted.push(String(new FormData(event.currentTarget).get('code')))
        })}
      >
        <Otp name="code" autoSubmit />
      </form>,
    )
    t.after(cleanup)
    let slots = slotsOf(container)
    await act(() => slots[0].focus())
    await act(() => paste(slots[0], '5555'))
    await act(tick)
    expect(submitted).toEqual(['5555'])
  })

  it('dispatches bubbling change and complete events', async (t) => {
    let changes: otpField.OTPFieldChangeEvent[] = []
    let completes: otpField.OTPFieldCompleteEvent[] = []
    let { act, container, cleanup } = render(
      <div
        mix={[
          otpField.onOTPFieldChange((event) => void changes.push(event)),
          otpField.onOTPFieldComplete((event) => void completes.push(event)),
        ]}
      >
        <Otp length={2} />
      </div>,
    )
    t.after(cleanup)
    let slots = slotsOf(container)
    await act(() => slots[0].focus())
    await act(() => paste(slots[0], '12'))
    expect(changes[0]).toBeInstanceOf(otpField.OTPFieldChangeEvent)
    expect(changes[0].value).toBe('12')
    expect(changes[0].reason).toBe('input-paste')
    expect(completes[0].value).toBe('12')
  })

  it('ignores edits when disabled or read-only', async (t) => {
    let changes: string[] = []
    let { act, container, cleanup } = render(
      <Otp defaultValue="12" readOnly onValueChange={(v) => void changes.push(v)} />,
    )
    t.after(cleanup)
    let slots = slotsOf(container)
    expect(slots[0].readOnly).toBe(true)
    await act(() => slots[1].focus())
    await act(() => key(slots[1], 'Backspace'))
    await act(() => paste(slots[1], '99'))
    expect(changes).toEqual([])

    let disabled = render(<Otp disabled />)
    t.after(disabled.cleanup)
    let disabledSlots = slotsOf(disabled.container)
    expect(disabledSlots.every((slot) => slot.disabled)).toBe(true)
    expect(hiddenOf(disabled.container).disabled).toBe(true)
  })

  it('renders separators and accepts every mixin called with no arguments', (t) => {
    let { container, cleanup } = render(
      <otpField.Context length={2}>
        <div mix={otpField.root()}>
          <input mix={otpField.input()} />
          <div mix={otpField.separator()} />
          <input mix={otpField.input()} />
          <div mix={otpField.separator({ orientation: 'vertical' })} />
        </div>
      </otpField.Context>,
    )
    t.after(cleanup)
    let separators = container.querySelectorAll('[role="separator"]')
    expect(separators[0].getAttribute('aria-orientation')).toBe('horizontal')
    expect(separators[1].getAttribute('data-orientation')).toBe('vertical')
    expect(slotsOf(container).length).toBe(2)
  })
})

function submitForm(formNode: Element) {
  formNode.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
}

function FieldOtp(handle: Handle<Omit<otpField.OTPFieldContextProps, 'length'>>) {
  return () => (
    <otpField.Context length={3} {...handle.props}>
      <div id="otp-root" mix={otpField.root()}>
        <input mix={otpField.input()} />
        <input mix={otpField.input()} />
        <input mix={otpField.input()} />
      </div>
    </otpField.Context>
  )
}

describe('otp field in a field', () => {
  it('is labelled, described and named by the field', async (t) => {
    let { $, act, container, cleanup } = render(
      <field.Context name="code">
        <label mix={field.label()}>Code</label>
        <FieldOtp name="ignored" />
        <p mix={field.description()}>From the app</p>
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let slots = slotsOf(container)
    expect(($('label') as HTMLLabelElement).htmlFor).toBe(slots[0]!.id)
    expect($('#otp-root')!.getAttribute('aria-labelledby')).toBe($('label')!.id)
    expect(slots[1]!.getAttribute('aria-describedby')).toBe($('p')!.id)
    expect(hiddenOf(container).name).toBe('code')
    await act(() => {
      slots[0]!.focus()
      type(slots[0]!, '1')
    })
    await tick()
    expect($('#otp-root')!.hasAttribute('data-dirty')).toBe(true)
    expect($('#otp-root')!.hasAttribute('data-focused')).toBe(true)
  })

  it('blocks an incomplete code and focuses the first empty slot', async (t) => {
    let submitted: form.FormValues[] = []
    let { $, act, container, cleanup } = render(
      <form.Context onFormSubmit={(values) => void submitted.push(values)}>
        <form mix={form.root()}>
          <field.Context name="code">
            <FieldOtp required defaultValue="1" />
            <div id="error" mix={field.error({ match: 'patternMismatch' })}>
              Enter all digits
            </div>
          </field.Context>
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    let slots = slotsOf(container)
    await act(() => submitForm($('form')!))
    expect(submitted).toEqual([])
    expect(document.activeElement).toBe(slots[1])
    expect(slots[0]!.getAttribute('aria-invalid')).toBe('true')
    expect(slots[0]!.getAttribute('aria-describedby')).toBe('error')
    expect($('#otp-root')!.hasAttribute('data-invalid')).toBe(true)
    await act(() => paste(slots[1]!, '23'))
    await tick()
    expect($('#otp-root')!.hasAttribute('data-valid')).toBe(true)
    await act(() => submitForm($('form')!))
    expect(submitted).toEqual([{ code: '123' }])
  })

  it('marks the field touched when focus leaves the slots', async (t) => {
    let { $, act, container, cleanup } = render(
      <div>
        <field.Context validationMode="onBlur">
          <FieldOtp required />
        </field.Context>
        <button id="other">Other</button>
      </div>,
    )
    t.after(cleanup)
    let slots = slotsOf(container)
    await act(() => slots[0]!.focus())
    await act(() => ($('#other') as HTMLElement).focus())
    expect($('#otp-root')!.hasAttribute('data-touched')).toBe(true)
    expect($('#otp-root')!.hasAttribute('data-invalid')).toBe(true)
  })

  it('clears server errors on change', async (t) => {
    let { $, act, container, cleanup } = render(
      <form.Context errors={{ code: 'Expired' }}>
        <field.Context name="code">
          <FieldOtp />
        </field.Context>
      </form.Context>,
    )
    t.after(cleanup)
    let slots = slotsOf(container)
    expect(slots[0]!.getAttribute('aria-invalid')).toBe('true')
    await act(() => type(slots[0]!, '4'))
    expect(slots[0]!.hasAttribute('aria-invalid')).toBe(false)
    expect($('#otp-root')!.hasAttribute('data-invalid')).toBe(false)
  })

  it('is disabled by the field or an enclosing fieldset', (t) => {
    let { container, cleanup } = render(
      <div>
        <field.Context disabled>
          <FieldOtp />
        </field.Context>
        <fieldset.Context disabled>
          <FieldOtp />
        </fieldset.Context>
      </div>,
    )
    t.after(cleanup)
    for (let input of [...container.querySelectorAll('input')]) expect(input.disabled).toBe(true)
  })
})

import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { createRoot, on, type Handle } from 'remix/component'
import { render } from 'remix/component/test'

import {
  onToggleButtonChange,
  toggleButton,
  type ToggleButtonChangeEvent,
} from './toggle-button.ts'
import * as fieldset from './fieldset.ts'
import * as toggleButtonGroup from './toggle-button-group.ts'

function key(target: Element, value: string) {
  let event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value })
  target.dispatchEvent(event)
  return event
}

function buttons(container: Element) {
  return [...container.querySelectorAll('[aria-pressed]')] as HTMLElement[]
}

function summary(container: Element) {
  return buttons(container).map(
    (node) =>
      `${node.textContent}:${node.getAttribute('aria-pressed')}:${node.getAttribute('tabindex')}`,
  )
}

const values = ['left', 'center', 'right']

describe('toggle-button-group', () => {
  it('renders group semantics, data attributes, and a single tab stop', (t) => {
    let { $, container, cleanup } = render(
      <toggleButtonGroup.Context defaultValue={['center']}>
        <div aria-label="Alignment" mix={toggleButtonGroup.root()}>
          {values.map((value) => (
            <button mix={toggleButton({ value })}>{value}</button>
          ))}
        </div>
      </toggleButtonGroup.Context>,
    )
    t.after(cleanup)

    let group = $('[role="group"]') as HTMLElement
    expect(group.getAttribute('data-orientation')).toBe('horizontal')
    expect(group.hasAttribute('data-disabled')).toBe(false)
    expect(group.hasAttribute('data-multiple')).toBe(false)
    expect(summary(container)).toEqual(['left:false:0', 'center:true:-1', 'right:false:-1'])
    expect(buttons(container)[1]!.getAttribute('data-pressed')).toBe('')
  })

  it('presses one button at a time by default (uncontrolled)', async (t) => {
    let changes: string[][] = []
    let groupEvents: toggleButtonGroup.ToggleButtonGroupChangeEvent[] = []
    let buttonEvents: ToggleButtonChangeEvent[] = []
    let pressedChanges: boolean[] = []
    let { act, container, cleanup } = render(
      <toggleButtonGroup.Context onValueChange={(value) => void changes.push(value)}>
        <div
          aria-label="Alignment"
          mix={[
            toggleButtonGroup.root(),
            toggleButtonGroup.onToggleButtonGroupChange((event) => void groupEvents.push(event)),
            onToggleButtonChange((event) => void buttonEvents.push(event)),
          ]}
        >
          <button mix={toggleButton({ value: 'left' })}>left</button>
          <button
            mix={toggleButton({
              value: 'center',
              // Ignored inside a group.
              defaultPressed: true,
              onPressedChange: (pressed) => void pressedChanges.push(pressed),
            })}
          >
            center
          </button>
          <button mix={toggleButton({ value: 'right' })}>right</button>
        </div>
      </toggleButtonGroup.Context>,
    )
    t.after(cleanup)

    let [left, center] = buttons(container)
    expect(center!.getAttribute('aria-pressed')).toBe('false')

    await act(() => left!.click())
    expect(changes).toEqual([['left']])
    await act(() => center!.click())
    expect(changes).toEqual([['left'], ['center']])
    expect(summary(container).map((s) => s.split(':')[1])).toEqual(['false', 'true', 'false'])
    expect(pressedChanges).toEqual([true])

    // Releasing the pressed button leaves nothing pressed.
    await act(() => center!.click())
    expect(changes).toEqual([['left'], ['center'], []])
    expect(pressedChanges).toEqual([true, false])

    expect(groupEvents.map((event) => event.value)).toEqual([['left'], ['center'], []])
    expect(groupEvents[1]).toBeInstanceOf(toggleButtonGroup.ToggleButtonGroupChangeEvent)
    expect(groupEvents[1]?.target).toBe(center)
    expect(buttonEvents.map((event) => `${event.value}:${event.pressed}`)).toEqual([
      'left:true',
      'center:true',
      'center:false',
    ])
  })

  it('presses several buttons with multiple', async (t) => {
    let changes: string[][] = []
    let { $, act, container, cleanup } = render(
      <toggleButtonGroup.Context
        multiple
        defaultValue={['bold']}
        onValueChange={(value) => void changes.push(value)}
      >
        <div aria-label="Formatting" mix={toggleButtonGroup.root()}>
          {['bold', 'italic', 'underline'].map((value) => (
            <button mix={toggleButton({ value })}>{value}</button>
          ))}
        </div>
      </toggleButtonGroup.Context>,
    )
    t.after(cleanup)

    expect(($('[role="group"]') as HTMLElement).getAttribute('data-multiple')).toBe('')
    let [bold, italic, underline] = buttons(container)
    await act(() => italic!.click())
    await act(() => underline!.click())
    await act(() => bold!.click())
    expect(changes).toEqual([
      ['bold', 'italic'],
      ['bold', 'italic', 'underline'],
      ['italic', 'underline'],
    ])
    expect(summary(container).map((s) => s.split(':')[1])).toEqual(['false', 'true', 'true'])
  })

  it('supports controlled value', async (t) => {
    let changes: string[][] = []

    function Controlled(handle: Handle) {
      let value: string[] = ['right']
      return () => (
        <div>
          <toggleButtonGroup.Context
            value={value}
            onValueChange={(next) => {
              changes.push(next)
              value = next
              void handle.update()
            }}
          >
            <div aria-label="Alignment" mix={toggleButtonGroup.root()}>
              {values.map((v) => (
                <button mix={toggleButton({ value: v })}>{v}</button>
              ))}
            </div>
          </toggleButtonGroup.Context>
          <button
            id="reset"
            mix={on('click', () => {
              value = ['left']
              void handle.update()
            })}
          >
            reset
          </button>
        </div>
      )
    }

    let { $, act, container, cleanup } = render(<Controlled />)
    t.after(cleanup)
    let pressed = () =>
      buttons(container)
        .filter((node) => node.getAttribute('aria-pressed') === 'true')
        .map((node) => node.textContent)

    expect(pressed()).toEqual(['right'])
    await act(() => buttons(container)[1]!.click())
    expect(changes).toEqual([['center']])
    expect(pressed()).toEqual(['center'])

    await act(() => ($('#reset') as HTMLElement).click())
    expect(pressed()).toEqual(['left'])
  })

  it('stays put when controlled and the owner ignores the change', async (t) => {
    let changes: string[][] = []
    let { act, container, cleanup } = render(
      <toggleButtonGroup.Context value={['left']} onValueChange={(v) => void changes.push(v)}>
        <div aria-label="Alignment" mix={toggleButtonGroup.root()}>
          {values.map((value) => (
            <button mix={toggleButton({ value })}>{value}</button>
          ))}
        </div>
      </toggleButtonGroup.Context>,
    )
    t.after(cleanup)

    await act(() => buttons(container)[2]!.click())
    expect(changes).toEqual([['right']])
    expect(summary(container).map((s) => s.split(':')[1])).toEqual(['true', 'false', 'false'])
  })

  it('moves focus with Left/Right (looping by default), Home, and End, skipping disabled', async (t) => {
    let changes: string[][] = []
    let { act, container, cleanup } = render(
      <toggleButtonGroup.Context onValueChange={(v) => void changes.push(v)}>
        <div aria-label="Letters" mix={toggleButtonGroup.root()}>
          <button mix={toggleButton({ value: 'a' })}>a</button>
          <button mix={toggleButton({ value: 'b', disabled: true })}>b</button>
          <button mix={toggleButton({ value: 'c' })}>c</button>
          <button mix={toggleButton({ value: 'd' })}>d</button>
        </div>
      </toggleButtonGroup.Context>,
    )
    t.after(cleanup)

    let [a, b, c, d] = buttons(container)
    expect(summary(container)).toEqual(['a:false:0', 'b:false:null', 'c:false:-1', 'd:false:-1'])
    expect((b as HTMLButtonElement).disabled).toBe(true)

    a!.focus()
    let event = key(a!, 'ArrowRight')
    expect(event.defaultPrevented).toBe(true)
    await act(() => Promise.resolve())
    expect(document.activeElement).toBe(c)
    // The focused button becomes the tab stop.
    expect(summary(container)).toEqual(['a:false:-1', 'b:false:null', 'c:false:0', 'd:false:-1'])

    await act(() => key(c!, 'ArrowRight'))
    expect(document.activeElement).toBe(d)
    await act(() => key(d!, 'ArrowRight'))
    expect(document.activeElement).toBe(a)
    await act(() => key(a!, 'ArrowLeft'))
    expect(document.activeElement).toBe(d)
    await act(() => key(d!, 'Home'))
    expect(document.activeElement).toBe(a)
    await act(() => key(a!, 'End'))
    expect(document.activeElement).toBe(d)

    // Vertical arrows are ignored in a horizontal group, and focus never presses.
    expect(key(d!, 'ArrowDown').defaultPrevented).toBe(false)
    expect(changes).toEqual([])
  })

  it('stops at the ends without loopFocus and uses Up/Down when vertical', async (t) => {
    let { $, act, container, cleanup } = render(
      <toggleButtonGroup.Context orientation="vertical" loopFocus={false}>
        <div aria-label="Letters" mix={toggleButtonGroup.root()}>
          <button mix={toggleButton({ value: 'a' })}>a</button>
          <button mix={toggleButton({ value: 'b' })}>b</button>
        </div>
      </toggleButtonGroup.Context>,
    )
    t.after(cleanup)

    expect(($('[role="group"]') as HTMLElement).getAttribute('data-orientation')).toBe('vertical')
    let [a, b] = buttons(container)
    a!.focus()
    await act(() => key(a!, 'ArrowUp'))
    expect(document.activeElement).toBe(a)
    expect(key(a!, 'ArrowRight').defaultPrevented).toBe(false)
    await act(() => key(a!, 'ArrowDown'))
    expect(document.activeElement).toBe(b)
    await act(() => key(b!, 'ArrowDown'))
    expect(document.activeElement).toBe(b)
  })

  it('mirrors Left/Right in RTL', async (t) => {
    let { act, container, cleanup } = render(
      <div dir="rtl">
        <toggleButtonGroup.Context>
          <div aria-label="Letters" mix={toggleButtonGroup.root()}>
            <button mix={toggleButton({ value: 'a' })}>a</button>
            <button mix={toggleButton({ value: 'b' })}>b</button>
            <button mix={toggleButton({ value: 'c' })}>c</button>
          </div>
        </toggleButtonGroup.Context>
      </div>,
    )
    t.after(cleanup)

    let [a, b] = buttons(container)
    a!.focus()
    await act(() => key(a!, 'ArrowLeft'))
    expect(document.activeElement).toBe(b)
    await act(() => key(b!, 'ArrowRight'))
    expect(document.activeElement).toBe(a)
  })

  it('disables every button when the group is disabled', async (t) => {
    let changes: string[][] = []
    let { $, act, container, cleanup } = render(
      <toggleButtonGroup.Context disabled onValueChange={(v) => void changes.push(v)}>
        <div aria-label="Letters" mix={toggleButtonGroup.root()}>
          <button mix={toggleButton({ value: 'a' })}>a</button>
          <span mix={toggleButton({ value: 'b' })}>b</span>
        </div>
      </toggleButtonGroup.Context>,
    )
    t.after(cleanup)

    expect(($('[role="group"]') as HTMLElement).getAttribute('data-disabled')).toBe('')
    let [a, b] = buttons(container)
    expect((a as HTMLButtonElement).disabled).toBe(true)
    expect(b!.getAttribute('aria-disabled')).toBe('true')
    expect(b!.hasAttribute('tabindex')).toBe(false)
    expect(b!.getAttribute('data-disabled')).toBe('')

    await act(() => b!.click())
    expect(changes).toEqual([])
  })

  it('supports non-button hosts with Space, Enter, and arrow keys', async (t) => {
    let changes: string[][] = []
    let { act, container, cleanup } = render(
      <toggleButtonGroup.Context onValueChange={(v) => void changes.push(v)}>
        <div aria-label="Letters" mix={toggleButtonGroup.root()}>
          <span mix={toggleButton({ value: 'a' })}>a</span>
          <span mix={toggleButton({ value: 'b' })}>b</span>
        </div>
      </toggleButtonGroup.Context>,
    )
    t.after(cleanup)

    let [a, b] = buttons(container)
    expect(a!.getAttribute('role')).toBe('button')
    expect(a!.tabIndex).toBe(0)
    expect(b!.tabIndex).toBe(-1)

    a!.focus()
    await act(() => key(a!, 'Enter'))
    expect(changes).toEqual([['a']])
    await act(() => key(a!, 'ArrowRight'))
    expect(document.activeElement).toBe(b)
    expect(key(b!, ' ').defaultPrevented).toBe(true)
    await act(() => b!.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' })))
    expect(changes).toEqual([['a'], ['b']])
  })

  it('keeps standalone toggle buttons outside the group independent', async (t) => {
    let { act, container, cleanup } = render(
      <div>
        <toggleButtonGroup.Context>
          <div aria-label="Letters" mix={toggleButtonGroup.root()}>
            <button mix={toggleButton({ value: 'a' })}>a</button>
          </div>
        </toggleButtonGroup.Context>
        <button mix={toggleButton({ defaultPressed: true })}>solo</button>
      </div>,
    )
    t.after(cleanup)

    let [, solo] = buttons(container)
    expect(solo!.getAttribute('aria-pressed')).toBe('true')
    expect(solo!.hasAttribute('tabindex')).toBe(false)
    await act(() => solo!.click())
    expect(solo!.getAttribute('aria-pressed')).toBe('false')
  })

  it('throws a helpful error for root() outside a Context', (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    let errors: unknown[] = []
    root.addEventListener('error', (event) => void errors.push((event as ErrorEvent).error))
    t.after(() => {
      root.dispose()
      container.remove()
    })

    root.render(<div mix={toggleButtonGroup.root()} />)
    root.flush()

    expect(String(errors[0])).toMatch(/toggleButtonGroup\.root\(\) must be rendered inside/)
  })
})

describe('toggle button group in a fieldset', () => {
  it('is disabled by an enclosing disabled fieldset', async (t) => {
    let { $, act, container, cleanup } = render(
      <fieldset.Context disabled>
        <toggleButtonGroup.Context>
          <div mix={toggleButtonGroup.root()}>
            <button mix={toggleButton({ value: 'bold' })}>B</button>
          </div>
        </toggleButtonGroup.Context>
      </fieldset.Context>,
    )
    t.after(cleanup)
    expect($('[role="group"]')!.hasAttribute('data-disabled')).toBe(true)
    let [button] = buttons(container)
    expect((button as HTMLButtonElement).disabled).toBe(true)
    await act(() => button!.click())
    expect(button!.getAttribute('aria-pressed')).toBe('false')
  })
})

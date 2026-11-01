import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { on, type Handle } from 'remix/component'
import { render } from 'remix/component/test'

import { ToggleButtonChangeEvent, onToggleButtonChange, toggleButton } from './toggle-button.ts'

function key(target: Element, type: 'keydown' | 'keyup', value: string) {
  let event = new KeyboardEvent(type, { bubbles: true, cancelable: true, key: value })
  target.dispatchEvent(event)
  return event
}

describe('toggleButton', () => {
  it('renders an unpressed native button', (t) => {
    let { $, cleanup } = render(<button mix={toggleButton()}>Bold</button>)
    t.after(cleanup)

    let button = $('button') as HTMLButtonElement
    expect(button.type).toBe('button')
    expect(button.hasAttribute('role')).toBe(false)
    expect(button.hasAttribute('tabindex')).toBe(false)
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.hasAttribute('data-pressed')).toBe(false)
    expect(button.hasAttribute('data-disabled')).toBe(false)
  })

  it('toggles on click (uncontrolled) and dispatches events', async (t) => {
    let changes: boolean[] = []
    let events: ToggleButtonChangeEvent[] = []
    let { $, act, cleanup } = render(
      <div mix={onToggleButtonChange((event) => void events.push(event))}>
        <button
          mix={toggleButton({
            defaultPressed: true,
            value: 'bold',
            onPressedChange: (pressed) => void changes.push(pressed),
          })}
        >
          Bold
        </button>
      </div>,
    )
    t.after(cleanup)

    let button = $('button') as HTMLButtonElement
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.getAttribute('data-pressed')).toBe('')

    await act(() => button.click())
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.hasAttribute('data-pressed')).toBe(false)

    await act(() => button.click())
    expect(button.getAttribute('aria-pressed')).toBe('true')

    expect(changes).toEqual([false, true])
    expect(events.length).toBe(2)
    expect(events[0]).toBeInstanceOf(ToggleButtonChangeEvent)
    expect(events[0]?.pressed).toBe(false)
    expect(events[0]?.value).toBe('bold')
    expect(events[0]?.target).toBe(button)
  })

  it('passes the triggering DOM event to onPressedChange', async (t) => {
    let received: Event[] = []
    let { $, act, cleanup } = render(
      <button mix={toggleButton({ onPressedChange: (_p, event) => void received.push(event) })}>
        Bold
      </button>,
    )
    t.after(cleanup)

    await act(() => ($('button') as HTMLElement).click())
    expect(received[0]?.type).toBe('click')
  })

  it('supports controlled state', async (t) => {
    let changes: boolean[] = []

    function Controlled(handle: Handle) {
      let pressed = false
      return () => (
        <div>
          <button
            id="toggle"
            mix={toggleButton({
              pressed,
              onPressedChange: (next) => {
                changes.push(next)
                pressed = next
                void handle.update()
              },
            })}
          >
            Bold
          </button>
          <button
            id="external"
            mix={on('click', () => {
              pressed = !pressed
              void handle.update()
            })}
          >
            External
          </button>
        </div>
      )
    }

    let { $, act, cleanup } = render(<Controlled />)
    t.after(cleanup)

    let toggle = $('#toggle') as HTMLButtonElement

    await act(() => toggle.click())
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(toggle.hasAttribute('data-pressed')).toBe(true)

    await act(() => ($('#external') as HTMLElement).click())
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(changes).toEqual([true])
  })

  it('stays put when controlled and the owner ignores the change', async (t) => {
    let changes: boolean[] = []
    let { $, act, cleanup } = render(
      <button mix={toggleButton({ pressed: false, onPressedChange: (p) => void changes.push(p) })}>
        Bold
      </button>,
    )
    t.after(cleanup)

    await act(() => ($('button') as HTMLElement).click())
    expect(changes).toEqual([true])
    expect($('button')!.getAttribute('aria-pressed')).toBe('false')
  })

  it('does not toggle when disabled', async (t) => {
    let changes: boolean[] = []
    let { $$, act, cleanup } = render(
      <div>
        <button
          mix={toggleButton({ disabled: true, onPressedChange: (p) => void changes.push(p) })}
        >
          Option
        </button>
        <button disabled mix={toggleButton({ onPressedChange: (p) => void changes.push(p) })}>
          Host prop
        </button>
        <span mix={toggleButton({ disabled: true, onPressedChange: (p) => void changes.push(p) })}>
          Span
        </span>
      </div>,
    )
    t.after(cleanup)

    let [option, hostProp, span] = [...$$('[aria-pressed]')] as HTMLElement[]

    expect((option as HTMLButtonElement).disabled).toBe(true)
    expect(option!.hasAttribute('data-disabled')).toBe(true)
    expect(hostProp!.hasAttribute('data-disabled')).toBe(true)
    expect(span!.getAttribute('aria-disabled')).toBe('true')
    expect(span!.hasAttribute('data-disabled')).toBe(true)
    expect(span!.hasAttribute('tabindex')).toBe(false)

    await act(() => {
      option!.click()
      hostProp!.click()
      span!.click()
      key(span!, 'keydown', 'Enter')
    })

    expect(changes).toEqual([])
    expect(span!.getAttribute('aria-pressed')).toBe('false')
  })

  it('gives non-button hosts button semantics and keyboard activation', async (t) => {
    let changes: boolean[] = []
    let { $, act, cleanup } = render(
      <span mix={toggleButton({ onPressedChange: (p) => void changes.push(p) })}>Italic</span>,
    )
    t.after(cleanup)

    let host = $('span') as HTMLElement
    expect(host.getAttribute('role')).toBe('button')
    expect(host.tabIndex).toBe(0)

    let keydown = key(host, 'keydown', ' ')
    expect(keydown.defaultPrevented).toBe(true)
    await act(() => {})
    expect(host.getAttribute('aria-pressed')).toBe('false')

    await act(() => key(host, 'keyup', ' '))
    expect(host.getAttribute('aria-pressed')).toBe('true')

    await act(() => key(host, 'keydown', 'Enter'))
    expect(host.getAttribute('aria-pressed')).toBe('false')
    expect(changes).toEqual([true, false])
  })

  it('does not submit an enclosing form', async (t) => {
    let submits = 0
    let { $, act, cleanup } = render(
      <form
        mix={on('submit', (event) => {
          event.preventDefault()
          submits++
        })}
      >
        <button mix={toggleButton()}>Bold</button>
      </form>,
    )
    t.after(cleanup)

    await act(() => ($('button') as HTMLElement).click())
    expect(submits).toBe(0)
    expect($('button')!.getAttribute('aria-pressed')).toBe('true')
  })

  it('lets explicit host props win', (t) => {
    let { $, cleanup } = render(
      <button type="submit" mix={toggleButton()}>
        Bold
      </button>,
    )
    t.after(cleanup)

    expect(($('button') as HTMLButtonElement).type).toBe('submit')
  })
})

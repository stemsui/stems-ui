// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/select.test.tsx).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'

import * as field from './field.ts'
import * as fieldset from './fieldset.ts'
import * as form from './form.ts'
import * as select from './select.tsx'
import { SelectChangeEvent, SelectOpenChangeEvent, onSelectChange } from './select.tsx'
import type { SelectOpenChangeDetails, SelectValueChangeDetails } from './select.tsx'

type T = { after(fn: () => void): void }

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

async function waitFor(condition: () => boolean, timeout = 1000) {
  let start = performance.now()
  while (!condition()) {
    if (performance.now() - start > timeout) throw new Error('waitFor timed out')
    await nextFrame()
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function addStyle(t: T, css: string) {
  let style = document.createElement('style')
  style.textContent = css
  document.head.append(style)
  t.after(() => style.remove())
}

const BASE_CSS = `
  [data-test-trigger] { position: fixed; top: 100px; left: 100px; width: 160px; height: 32px;
    margin: 0; padding: 0 0 0 10px; border: 0; box-sizing: border-box; text-align: left; }
  [data-test-popup] { margin: 0; padding: 4px; border: 0; width: 200px; }
  [role="option"] { height: 24px; padding-left: 8px; }
`

function key(target: Element, value: string, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value, ...init })
  target.dispatchEvent(event)
  return event
}

function pointer(target: Element, type: string, init: PointerEventInit = {}) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'mouse', ...init }))
}

function isShown(element: HTMLElement) {
  return element.matches(':popover-open')
}

const FRUITS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'blueberry', label: 'Blueberry', disabled: true },
  { value: 'cherry', label: 'Cherry' },
  { value: 'grape', label: 'Grape' },
]

type HarnessProps = select.SelectContextProps & {
  popupOptions?: select.SelectPopupOptions
  noArgs?: boolean
  placeholder?: string
  withIndicators?: boolean
  withScrollArrows?: boolean
  withLabel?: boolean
  noList?: boolean
  options?: typeof FRUITS
  extra?: RemixNode
}

function Harness(handle: Handle<HarnessProps>) {
  return () => {
    let {
      popupOptions,
      noArgs,
      placeholder = 'Pick a fruit',
      withIndicators,
      withScrollArrows,
      withLabel,
      noList,
      options = FRUITS,
      extra,
      children: _children,
      ...props
    } = handle.props
    let items = options.map((fruit) =>
      withIndicators ? (
        <select.ItemContext value={fruit.value} disabled={fruit.disabled}>
          <div id={`item-${fruit.value}`} mix={select.item()}>
            <span mix={select.itemText()}>{fruit.label}</span>
            <span data-indicator={fruit.value} mix={select.itemIndicator()}>
              ✓
            </span>
          </div>
        </select.ItemContext>
      ) : (
        <div
          id={`item-${fruit.value}`}
          mix={select.item({ value: fruit.value, disabled: fruit.disabled })}
        >
          {fruit.label}
        </div>
      ),
    )
    return (
      <div>
        <select.Context {...props}>
          {withLabel ? (
            <div id="label" mix={select.label()}>
              Fruit
            </div>
          ) : null}
          <button
            id="trigger"
            data-test-trigger
            mix={noArgs ? select.trigger() : select.trigger({})}
          >
            <span id="value" mix={select.value()}>
              <select.ValueText placeholder={placeholder} />
            </span>
            <span id="icon" mix={select.icon()}>
              ▾
            </span>
          </button>
          <div
            id="popup"
            data-test-popup
            mix={noArgs ? select.popup() : select.popup(popupOptions)}
          >
            {withScrollArrows ? <div id="up" mix={select.scrollUpArrow()} /> : null}
            {noList ? (
              items
            ) : (
              <div id="list" mix={select.list()}>
                {items}
              </div>
            )}
            {withScrollArrows ? <div id="down" mix={select.scrollDownArrow()} /> : null}
          </div>
          {extra}
        </select.Context>
        <button id="outside">Outside</button>
      </div>
    )
  }
}

function setup(t: T, props: HarnessProps = {}) {
  addStyle(t, BASE_CSS)
  let result = render(<Harness {...props} />)
  t.after(result.cleanup)
  let get = (id: string) => result.$(`#${id}`) as HTMLElement
  return {
    ...result,
    trigger: get('trigger') as HTMLButtonElement,
    popup: get('popup'),
    list: get('list'),
    value: get('value'),
    get,
    item: (value: string) => get(`item-${value}`),
  }
}

function setupControlled(
  t: T,
  options: { value?: unknown; accept?: boolean; props?: HarnessProps } = {},
) {
  addStyle(t, BASE_CSS)
  let state: { value: unknown } = { value: options.value ?? null }
  let changes: Array<{ value: unknown; details: SelectValueChangeDetails }> = []
  let owner: Handle | undefined
  function App(handle: Handle) {
    owner = handle
    return () => (
      <Harness
        {...options.props}
        value={state.value}
        onValueChange={(value, details) => {
          changes.push({ value, details })
          if (options.accept !== false) {
            state.value = value
            void handle.update()
          }
        }}
      />
    )
  }
  let result = render(<App />)
  t.after(result.cleanup)
  let get = (id: string) => result.$(`#${id}`) as HTMLElement
  return {
    ...result,
    trigger: get('trigger') as HTMLButtonElement,
    popup: get('popup'),
    value: get('value'),
    get,
    item: (value: string) => get(`item-${value}`),
    changes,
    async setValue(value: unknown) {
      state.value = value
      await result.act(() => owner!.update())
    },
  }
}

describe('select', () => {
  it('renders ARIA and the closed state', (t) => {
    let { trigger, popup, list, value, get, item } = setup(t)

    expect(trigger.getAttribute('type')).toBe('button')
    expect(trigger.getAttribute('role')).toBe('combobox')
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-controls')).toBe(list.id)
    expect(trigger.hasAttribute('data-placeholder')).toBe(true)
    expect(trigger.hasAttribute('data-popup-open')).toBe(false)
    expect(value.hasAttribute('data-placeholder')).toBe(true)
    expect(value.textContent).toBe('Pick a fruit')
    expect(get('icon').getAttribute('aria-hidden')).toBe('true')

    expect(popup.getAttribute('popover')).toBe('manual')
    expect(popup.hasAttribute('hidden')).toBe(true)
    expect(popup.getAttribute('data-closed')).toBe('')
    expect(popup.hasAttribute('role')).toBe(false)
    expect(list.getAttribute('role')).toBe('listbox')
    expect(list.getAttribute('aria-labelledby')).toBe(trigger.id)
    expect(list.hasAttribute('aria-multiselectable')).toBe(false)

    let apple = item('apple')
    expect(apple.getAttribute('role')).toBe('option')
    expect(apple.getAttribute('aria-selected')).toBe('false')
    expect(apple.getAttribute('tabindex')).toBe('-1')
    expect(apple.hasAttribute('data-selected')).toBe(false)
    expect(apple.hasAttribute('data-highlighted')).toBe(false)
    let blueberry = item('blueberry')
    expect(blueberry.getAttribute('aria-disabled')).toBe('true')
    expect(blueberry.getAttribute('data-disabled')).toBe('')
  })

  it('works with no-argument mixin calls', async (t) => {
    let { act, trigger, popup } = setup(t, { noArgs: true })
    expect(trigger.getAttribute('role')).toBe('combobox')
    await act(() => trigger.click())
    expect(isShown(popup)).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('shows the defaultValue label, not the raw value or the placeholder', (t) => {
    let { trigger, value, item } = setup(t, { defaultValue: 'cherry' })
    expect(value.textContent).toBe('Cherry')
    expect(value.hasAttribute('data-placeholder')).toBe(false)
    expect(trigger.hasAttribute('data-placeholder')).toBe(false)
    expect(item('cherry').getAttribute('aria-selected')).toBe('true')
    expect(item('cherry').getAttribute('data-selected')).toBe('')
    expect(trigger.hasAttribute('aria-describedby')).toBe(false)
  })

  it('looks labels up from items and itemToStringLabel', (t) => {
    let first = setup(t, {
      defaultValue: 'banana',
      items: [
        { value: 'apple', label: 'Red apple' },
        { value: 'banana', label: 'Yellow banana' },
      ],
    })
    expect(first.value.textContent).toBe('Yellow banana')
    first.cleanup()

    let second = setup(t, { defaultValue: 'grape', items: { grape: 'Purple grape' } })
    expect(second.value.textContent).toBe('Purple grape')
    second.cleanup()

    let third = setup(t, {
      defaultValue: 'apple',
      itemToStringLabel: (value: string) => value.toUpperCase(),
    })
    expect(third.value.textContent).toBe('APPLE')
  })

  it('opens on click, focuses the selected item, and closes with Escape', async (t) => {
    let { act, trigger, popup, item } = setup(t, { defaultValue: 'cherry' })
    trigger.focus()
    await act(() => trigger.click())
    expect(isShown(popup)).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.getAttribute('data-popup-open')).toBe('')
    expect(trigger.getAttribute('data-pressed')).toBe('')
    expect(popup.getAttribute('data-open')).toBe('')
    await waitFor(() => document.activeElement === item('cherry'))
    expect(item('cherry').getAttribute('data-highlighted')).toBe('')

    await act(() => key(item('cherry'), 'Escape'))
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    await waitFor(() => document.activeElement === trigger)
    await waitFor(() => !isShown(popup))
  })

  it('selects an item on click, closes, and updates the label', async (t) => {
    let changes: unknown[] = []
    let { act, trigger, popup, value, item } = setup(t, {
      onValueChange: (next, details) => changes.push([next, details.reason]),
    })
    await act(() => trigger.click())
    await act(() => item('banana').click())
    expect(changes).toEqual([['banana', 'item-press']])
    expect(value.textContent).toBe('Banana')
    expect(item('banana').getAttribute('aria-selected')).toBe('true')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    await waitFor(() => !isShown(popup))
  })

  it('ignores disabled items', async (t) => {
    let { act, trigger, value, item } = setup(t)
    await act(() => trigger.click())
    await act(() => item('blueberry').click())
    expect(value.textContent).toBe('Pick a fruit')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('opens with ArrowDown / ArrowUp and highlights the first / last item', async (t) => {
    let { act, trigger, popup, item } = setup(t)
    trigger.focus()
    await act(() => key(trigger, 'ArrowDown'))
    expect(isShown(popup)).toBe(true)
    await waitFor(() => document.activeElement === item('apple'))
    await act(() => key(item('apple'), 'Escape'))
    await waitFor(() => !isShown(popup))

    await act(() => key(trigger, 'ArrowUp'))
    await waitFor(() => document.activeElement === item('grape'))
  })

  it('navigates with arrows, Home and End, skipping disabled items', async (t) => {
    let { act, trigger, item } = setup(t)
    trigger.focus()
    await act(() => key(trigger, 'ArrowDown'))
    await waitFor(() => document.activeElement === item('apple'))

    await act(() => key(item('apple'), 'ArrowDown'))
    expect(document.activeElement).toBe(item('banana'))
    await act(() => key(item('banana'), 'ArrowDown'))
    expect(document.activeElement).toBe(item('cherry'))
    expect(item('cherry').getAttribute('data-highlighted')).toBe('')
    expect(item('banana').hasAttribute('data-highlighted')).toBe(false)
    await act(() => key(item('cherry'), 'ArrowUp'))
    expect(document.activeElement).toBe(item('banana'))
    await act(() => key(item('banana'), 'End'))
    expect(document.activeElement).toBe(item('grape'))
    // No looping by default.
    await act(() => key(item('grape'), 'ArrowDown'))
    expect(document.activeElement).toBe(item('grape'))
    await act(() => key(item('grape'), 'Home'))
    expect(document.activeElement).toBe(item('apple'))
  })

  it('loops with loopFocus', async (t) => {
    let { act, trigger, item } = setup(t, { loopFocus: true })
    trigger.focus()
    await act(() => key(trigger, 'ArrowUp'))
    await waitFor(() => document.activeElement === item('grape'))
    await act(() => key(item('grape'), 'ArrowDown'))
    expect(document.activeElement).toBe(item('apple'))
  })

  it('selects the highlighted item with Enter and Space', async (t) => {
    let { act, trigger, popup, value, item } = setup(t)
    trigger.focus()
    await act(() => key(trigger, 'ArrowDown'))
    await waitFor(() => document.activeElement === item('apple'))
    await act(() => key(item('apple'), 'ArrowDown'))
    await act(() => key(item('banana'), 'Enter'))
    expect(value.textContent).toBe('Banana')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    await waitFor(() => !isShown(popup))
    await waitFor(() => document.activeElement === trigger)

    await act(() => key(trigger, 'ArrowDown'))
    await waitFor(() => document.activeElement === item('banana'))
    await act(() => key(item('banana'), 'ArrowDown'))
    await act(() => key(item('cherry'), ' '))
    expect(value.textContent).toBe('Cherry')
  })

  it('typeahead in the open list highlights without selecting', async (t) => {
    let { act, trigger, value, item } = setup(t)
    trigger.focus()
    await act(() => key(trigger, 'ArrowDown'))
    await waitFor(() => document.activeElement === item('apple'))
    await act(() => key(item('apple'), 'g'))
    expect(document.activeElement).toBe(item('grape'))
    expect(value.textContent).toBe('Pick a fruit')
    await sleep(800)
    // Multi-character search; disabled items are skipped.
    await act(() => key(item('grape'), 'b'))
    expect(document.activeElement).toBe(item('banana'))
    await act(() => key(item('banana'), 'l'))
    expect(document.activeElement).toBe(item('banana'))
    await sleep(800)
    // Repeating a letter cycles through the matches.
    await act(() => key(item('banana'), 'c'))
    expect(document.activeElement).toBe(item('cherry'))
    await act(() => key(item('cherry'), 'c'))
    expect(document.activeElement).toBe(item('cherry'))
    expect(value.textContent).toBe('Pick a fruit')
  })

  it('typeahead on the closed trigger selects the next match', async (t) => {
    let { act, trigger, popup, value } = setup(t)
    trigger.focus()
    await act(() => key(trigger, 'c'))
    expect(value.textContent).toBe('Cherry')
    expect(isShown(popup)).toBe(false)
    await sleep(800)
    await act(() => key(trigger, 'g'))
    await act(() => key(trigger, 'r'))
    expect(value.textContent).toBe('Grape')
    await sleep(800)
    // Space continues a search instead of opening the popup.
    await act(() => key(trigger, 'a'))
    expect(value.textContent).toBe('Apple')
    let space: KeyboardEvent | undefined
    await act(() => {
      space = key(trigger, ' ')
    })
    expect(space!.defaultPrevented).toBe(true)
    expect(isShown(popup)).toBe(false)
  })

  it('highlights on pointer move', async (t) => {
    let { act, trigger, item } = setup(t)
    await act(() => trigger.click())
    await act(() => pointer(item('cherry'), 'pointermove'))
    expect(item('cherry').getAttribute('data-highlighted')).toBe('')
    expect(document.activeElement).toBe(item('cherry'))
    await act(() => pointer(item('cherry'), 'pointerleave'))
    expect(item('cherry').hasAttribute('data-highlighted')).toBe(false)
    // Disabled items are not highlighted.
    await act(() => pointer(item('blueberry'), 'pointermove'))
    expect(item('blueberry').hasAttribute('data-highlighted')).toBe(false)
  })

  it('Tab closes the popup and moves on from the trigger', async (t) => {
    let { act, trigger, popup, get, item } = setup(t)
    trigger.focus()
    await act(() => key(trigger, 'ArrowDown'))
    await waitFor(() => document.activeElement === item('apple'))
    let event: KeyboardEvent | undefined
    await act(() => {
      event = key(item('apple'), 'Tab')
    })
    expect(event!.defaultPrevented).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    await waitFor(() => document.activeElement === get('outside'))
    await waitFor(() => !isShown(popup))
  })

  it('supports controlled value', async (t) => {
    let { act, trigger, value, item, changes, setValue } = setupControlled(t, { value: 'apple' })
    expect(value.textContent).toBe('Apple')
    await setValue('grape')
    expect(value.textContent).toBe('Grape')
    expect(item('grape').getAttribute('aria-selected')).toBe('true')

    await act(() => trigger.click())
    await act(() => item('banana').click())
    expect(changes.length).toBe(1)
    expect(changes[0].value).toBe('banana')
    expect(changes[0].details.reason).toBe('item-press')
    expect(value.textContent).toBe('Banana')

    await setValue(null)
    expect(value.textContent).toBe('Pick a fruit')
    expect(trigger.hasAttribute('data-placeholder')).toBe(true)
  })

  it('keeps the value when the owner rejects the change or cancels it', async (t) => {
    let { act, trigger, value, item, changes } = setupControlled(t, {
      value: 'apple',
      accept: false,
    })
    await act(() => trigger.click())
    await act(() => item('banana').click())
    expect(changes.length).toBe(1)
    expect(value.textContent).toBe('Apple')
    expect(item('apple').getAttribute('aria-selected')).toBe('true')

    let canceled = setup(t, {
      defaultValue: 'apple',
      onValueChange: (_value, details) => details.cancel(),
    })
    await canceled.act(() => canceled.trigger.click())
    await canceled.act(() => canceled.item('cherry').click())
    expect(canceled.value.textContent).toBe('Apple')
  })

  it('supports controlled open', async (t) => {
    addStyle(t, BASE_CSS)
    let state = { open: false }
    let calls: Array<[boolean, SelectOpenChangeDetails['reason']]> = []
    let owner: Handle | undefined
    function App(handle: Handle) {
      owner = handle
      return () => (
        <Harness
          open={state.open}
          onOpenChange={(open, details) => {
            calls.push([open, details.reason])
            state.open = open
            void handle.update()
          }}
        />
      )
    }
    let result = render(<App />)
    t.after(result.cleanup)
    let popup = result.$('#popup') as HTMLElement
    let trigger = result.$('#trigger') as HTMLElement
    state.open = true
    await result.act(() => owner!.update())
    await waitFor(() => isShown(popup))
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    await result.act(() => (result.$('#item-apple') as HTMLElement).click())
    expect(calls).toEqual([[false, 'item-press']])
    await waitFor(() => !isShown(popup))
  })

  it('dispatches change events', async (t) => {
    let events: Array<[string, unknown, string]> = []
    addStyle(t, BASE_CSS)
    let result = render(
      <div
        mix={[
          onSelectChange((event) => void events.push(['change', event.value, event.reason])),
          select.onSelectOpenChange(
            (event) => void events.push(['open', event.open, event.reason]),
          ),
        ]}
      >
        <Harness />
      </div>,
    )
    t.after(result.cleanup)
    let trigger = result.$('#trigger') as HTMLElement
    await result.act(() => trigger.click())
    await result.act(() => (result.$('#item-grape') as HTMLElement).click())
    expect(events).toEqual([
      ['open', true, 'trigger-press'],
      ['change', 'grape', 'item-press'],
      ['open', false, 'item-press'],
    ])
    expect(new SelectChangeEvent('x', 'none').bubbles).toBe(true)
    expect(new SelectOpenChangeEvent(true, 'none').type).toBe('stems:select-open-change')
  })

  it('does not open while disabled or readOnly', async (t) => {
    let disabled = setup(t, { disabled: true })
    expect(disabled.trigger.disabled).toBe(true)
    expect(disabled.trigger.getAttribute('data-disabled')).toBe('')
    await disabled.act(() => disabled.trigger.click())
    expect(disabled.trigger.getAttribute('aria-expanded')).toBe('false')
    disabled.cleanup()

    let readOnly = setup(t, { readOnly: true, defaultValue: 'apple' })
    expect(readOnly.trigger.getAttribute('aria-readonly')).toBe('true')
    expect(readOnly.trigger.getAttribute('data-readonly')).toBe('')
    await readOnly.act(() => readOnly.trigger.click())
    expect(readOnly.trigger.getAttribute('aria-expanded')).toBe('false')
    readOnly.trigger.focus()
    await readOnly.act(() => key(readOnly.trigger, 'c'))
    expect(readOnly.value.textContent).toBe('Apple')
  })
})

describe('select (multiple)', () => {
  it('toggles items, keeps the popup open, and joins labels', async (t) => {
    let changes: unknown[] = []
    let { act, trigger, popup, list, value, item } = setup(t, {
      multiple: true,
      defaultValue: ['apple'],
      onValueChange: (next) => changes.push(next),
    })
    expect(list.getAttribute('aria-multiselectable')).toBe('true')
    expect(value.textContent).toBe('Apple')

    await act(() => trigger.click())
    await act(() => item('cherry').click())
    expect(changes).toEqual([['apple', 'cherry']])
    expect(value.textContent).toBe('Apple, Cherry')
    expect(isShown(popup)).toBe(true)
    expect(item('cherry').getAttribute('aria-selected')).toBe('true')

    await act(() => item('apple').click())
    expect(changes.at(-1)).toEqual(['cherry'])
    expect(value.textContent).toBe('Cherry')

    await act(() => key(item('apple'), 'Enter'))
    expect(value.textContent).toBe('Cherry, Apple')
    expect(isShown(popup)).toBe(true)
  })

  it('shows the placeholder for an empty array', (t) => {
    let { trigger, value } = setup(t, { multiple: true })
    expect(value.textContent).toBe('Pick a fruit')
    expect(trigger.hasAttribute('data-placeholder')).toBe(true)
  })

  it('submits one input per value', async (t) => {
    addStyle(t, BASE_CSS)
    let result = render(
      <form id="form">
        <Harness multiple name="fruits" defaultValue={['apple', 'grape']} />
      </form>,
    )
    t.after(result.cleanup)
    let form = result.$('#form') as HTMLFormElement
    expect(new FormData(form).getAll('fruits')).toEqual(['apple', 'grape'])
    await result.act(() => (result.$('#trigger') as HTMLElement).click())
    await result.act(() => (result.$('#item-apple') as HTMLElement).click())
    expect(new FormData(form).getAll('fruits')).toEqual(['grape'])
  })
})

describe('select (forms)', () => {
  it('participates in FormData', async (t) => {
    addStyle(t, BASE_CSS)
    let result = render(
      <form id="form">
        <Harness name="fruit" defaultValue="banana" />
      </form>,
    )
    t.after(result.cleanup)
    let form = result.$('#form') as HTMLFormElement
    expect(new FormData(form).get('fruit')).toBe('banana')
    await result.act(() => (result.$('#trigger') as HTMLElement).click())
    await result.act(() => (result.$('#item-cherry') as HTMLElement).click())
    expect(new FormData(form).get('fruit')).toBe('cherry')
  })

  it('submits itemToStringValue for object values', (t) => {
    addStyle(t, BASE_CSS)
    let methods = [
      { id: 'standard', name: 'Standard' },
      { id: 'express', name: 'Express' },
    ]
    let result = render(
      <form id="form">
        <select.Context
          name="shipping"
          defaultValue={methods[1]}
          itemToStringValue={(method: { id: string }) => method.id}
          itemToStringLabel={(method: { name: string }) => method.name}
        >
          <button id="trigger" mix={select.trigger()}>
            <span id="value" mix={select.value()}>
              <select.ValueText />
            </span>
          </button>
          <div mix={select.popup()}>
            <div mix={select.list()}>
              {methods.map((method) => (
                <div mix={select.item({ value: method })}>{method.name}</div>
              ))}
            </div>
          </div>
        </select.Context>
      </form>,
    )
    t.after(result.cleanup)
    expect(new FormData(result.$('#form') as HTMLFormElement).get('shipping')).toBe('express')
    expect((result.$('#value') as HTMLElement).textContent).toBe('Express')
  })

  it('supports required with native validation', async (t) => {
    addStyle(t, BASE_CSS)
    let result = render(
      <form id="form">
        <Harness name="fruit" required />
      </form>,
    )
    t.after(result.cleanup)
    let form = result.$('#form') as HTMLFormElement
    let trigger = result.$('#trigger') as HTMLElement
    expect(trigger.getAttribute('aria-required')).toBe('true')
    expect(trigger.getAttribute('data-required')).toBe('')
    expect(form.checkValidity()).toBe(false)
    await result.act(() => trigger.click())
    await result.act(() => (result.$('#item-apple') as HTMLElement).click())
    expect(form.checkValidity()).toBe(true)
  })

  it('redirects focus from the hidden input to the trigger', (t) => {
    let { trigger, container } = setup(t, { name: 'fruit' })
    let input = container.querySelector('input[name="fruit"]') as HTMLInputElement
    expect(input.getAttribute('aria-hidden')).toBe('true')
    expect(input.tabIndex).toBe(-1)
    input.focus()
    expect(document.activeElement).toBe(trigger)
  })

  it('disables the input while disabled', (t) => {
    let { container } = setup(t, { name: 'fruit', disabled: true, defaultValue: 'apple' })
    let input = container.querySelector('input[name="fruit"]') as HTMLInputElement
    expect(input.disabled).toBe(true)
  })
})

describe('select (parts)', () => {
  it('renders item indicators and item text from ItemContext', async (t) => {
    let { act, trigger, get, item } = setup(t, { withIndicators: true, defaultValue: 'banana' })
    let banana = get('item-banana').querySelector('[data-indicator]') as HTMLElement
    let apple = get('item-apple').querySelector('[data-indicator]') as HTMLElement
    expect(banana.hasAttribute('hidden')).toBe(false)
    expect(banana.getAttribute('aria-hidden')).toBe('true')
    expect(apple.hasAttribute('hidden')).toBe(true)
    expect(item('blueberry').getAttribute('aria-disabled')).toBe('true')

    await act(() => trigger.click())
    await act(() => item('apple').click())
    expect(apple.hasAttribute('hidden')).toBe(false)
    await waitFor(() => banana.hasAttribute('hidden'))
  })

  it('labels the trigger with label() and focuses it on press', async (t) => {
    let { act, trigger, list, get } = setup(t, { withLabel: true })
    let label = get('label')
    expect(trigger.getAttribute('aria-labelledby')).toBe(label.id)
    expect(list.getAttribute('aria-labelledby')).toBe(label.id)
    await act(() => label.click())
    expect(document.activeElement).toBe(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('labels groups', async (t) => {
    addStyle(t, BASE_CSS)
    let result = render(
      <select.Context>
        <button id="trigger" mix={select.trigger()} />
        <div mix={select.popup()}>
          <div mix={select.list()}>
            <div id="group" mix={select.group()}>
              <div id="group-label" mix={select.groupLabel()}>
                Fruits
              </div>
              <div mix={select.item({ value: 'apple' })}>Apple</div>
            </div>
            <div id="sep" mix={select.separator()} />
          </div>
        </div>
      </select.Context>,
    )
    t.after(result.cleanup)
    await result.act(() => {})
    let group = result.$('#group') as HTMLElement
    expect(group.getAttribute('role')).toBe('group')
    expect(group.getAttribute('aria-labelledby')).toBe('group-label')
    expect((result.$('#sep') as HTMLElement).getAttribute('role')).toBe('separator')
  })

  it('uses the popup as the listbox without a list part', async (t) => {
    let { act, trigger, popup } = setup(t, { noList: true, multiple: true })
    await act(() => {})
    expect(popup.getAttribute('role')).toBe('listbox')
    expect(popup.getAttribute('aria-multiselectable')).toBe('true')
    expect(trigger.getAttribute('aria-controls')).toBe(popup.id)
  })

  it('aligns the selected item with the trigger by default', async (t) => {
    let { act, trigger, popup, item } = setup(t, { defaultValue: 'cherry' })
    await act(() => trigger.click())
    await waitFor(() => popup.getAttribute('data-side') === 'none')
    let triggerRect = trigger.getBoundingClientRect()
    let itemRect = item('cherry').getBoundingClientRect()
    let valueRect = (document.getElementById('value') as HTMLElement).getBoundingClientRect()
    // Vertically centered over the trigger, inline-start edge on the value text.
    expect(
      Math.abs(itemRect.top + itemRect.height / 2 - (triggerRect.top + triggerRect.height / 2)),
    ).toBeLessThan(1.5)
    expect(Math.abs(itemRect.left - valueRect.left)).toBeLessThan(1.5)
  })

  it('positions below the trigger with alignItemWithTrigger: false', async (t) => {
    let { act, trigger, popup } = setup(t, {
      defaultValue: 'cherry',
      popupOptions: { alignItemWithTrigger: false, sideOffset: 4 },
    })
    await act(() => trigger.click())
    await waitFor(() => popup.getAttribute('data-side') === 'bottom')
    expect(popup.style.top).toBe('136px')
  })

  it('shows scroll arrows when the list overflows', async (t) => {
    addStyle(t, `#popup { max-height: 80px; overflow-y: auto; }`)
    let { act, trigger, get, item } = setup(t, {
      withScrollArrows: true,
      popupOptions: { alignItemWithTrigger: false },
    })
    let up = get('up')
    let down = get('down')
    expect(up.getAttribute('data-direction')).toBe('up')
    expect(down.getAttribute('data-direction')).toBe('down')
    expect(up.hasAttribute('hidden')).toBe(true)
    await act(() => trigger.click())
    await waitFor(() => down.hasAttribute('data-visible'))
    expect(down.hasAttribute('hidden')).toBe(false)
    expect(up.hasAttribute('data-visible')).toBe(false)
    await act(() => key(document.activeElement!, 'End'))
    expect(document.activeElement).toBe(item('grape'))
    await waitFor(() => up.hasAttribute('data-visible'))
  })

  it('locks scroll while modal (default) and not when modal is false', async (t) => {
    let modal = setup(t)
    await modal.act(() => modal.trigger.click())
    expect(document.documentElement.style.overflow).toBe('hidden')
    await modal.act(() => key(modal.popup, 'Escape'))
    modal.cleanup()

    let nonModal = setup(t, { modal: false })
    await nonModal.act(() => nonModal.trigger.click())
    expect(document.documentElement.style.overflow).toBe('')
  })
})

function submitForm(formNode: Element) {
  formNode.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
}

function FieldSelect(handle: Handle<select.SelectContextProps>) {
  return () => (
    <select.Context {...handle.props}>
      <button data-test-trigger mix={select.trigger()}>
        <span mix={select.value()}>
          <select.ValueText placeholder="Pick" />
        </span>
      </button>
      <div id="popup" data-test-popup mix={select.popup()}>
        <div mix={select.list()}>
          {FRUITS.map((fruit) => (
            <div id={`item-${fruit.value}`} mix={select.item({ value: fruit.value })}>
              {fruit.label}
            </div>
          ))}
        </div>
      </div>
    </select.Context>
  )
}

describe('select in a field', () => {
  it('is labelled, described and named by the field', async (t) => {
    addStyle(t, BASE_CSS)
    let { $, act, cleanup } = render(
      <field.Context name="fruit">
        <label mix={field.label()}>Fruit</label>
        <FieldSelect name="ignored" defaultValue="apple" />
        <p mix={field.description()}>Your favourite</p>
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let label = $('label') as HTMLLabelElement
    let trigger = $('[role="combobox"]') as HTMLElement
    expect(label.htmlFor).toBe(trigger.id)
    expect(trigger.getAttribute('aria-labelledby')).toBe(label.id)
    expect(trigger.getAttribute('aria-describedby')).toBe($('p')!.id)
    expect(($('input') as HTMLInputElement).name).toBe('fruit')
    expect(trigger.hasAttribute('data-filled')).toBe(true)
    expect(trigger.hasAttribute('data-dirty')).toBe(false)
  })

  it('lets the trigger id become the control id', async (t) => {
    let result = render(
      <field.Context>
        <label mix={field.label()}>Fruit</label>
        <Harness />
      </field.Context>,
    )
    t.after(result.cleanup)
    await result.act(() => {})
    expect((result.$('label') as HTMLLabelElement).htmlFor).toBe('trigger')
  })

  it('blocks a required select, focuses the trigger and re-validates on change', async (t) => {
    addStyle(t, BASE_CSS)
    let submitted: form.FormValues[] = []
    let { $, act, cleanup } = render(
      <form.Context onFormSubmit={(values) => void submitted.push(values)}>
        <form mix={form.root()}>
          <field.Context name="fruit">
            <FieldSelect required />
            <div id="error" mix={field.error({ match: 'valueMissing' })}>
              Pick a fruit
            </div>
          </field.Context>
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    let trigger = $('[role="combobox"]') as HTMLElement
    await act(() => submitForm($('form')!))
    expect(submitted).toEqual([])
    expect(document.activeElement).toBe(trigger)
    expect(trigger.getAttribute('aria-invalid')).toBe('true')
    expect(trigger.hasAttribute('data-invalid')).toBe(true)
    expect(trigger.getAttribute('aria-describedby')).toBe('error')

    await act(() => trigger.click())
    await waitFor(() => isShown($('#popup') as HTMLElement))
    await act(() => ($('#item-cherry') as HTMLElement).click())
    expect(trigger.hasAttribute('data-valid')).toBe(true)
    expect(trigger.hasAttribute('data-dirty')).toBe(true)
    await act(() => submitForm($('form')!))
    expect(submitted).toEqual([{ fruit: 'cherry' }])
  })

  it('validates a controlled value with the next value', async (t) => {
    let seen: unknown[] = []
    function Controlled(handle: Handle) {
      let value: string | null = null
      return () => (
        <field.Context
          validationMode="onChange"
          validate={(next) => {
            seen.push(next)
            return null
          }}
        >
          <FieldSelect
            value={value}
            onValueChange={(next) => {
              value = next
              void handle.update()
            }}
          />
        </field.Context>
      )
    }
    addStyle(t, BASE_CSS)
    let { $, act, cleanup } = render(<Controlled />)
    t.after(cleanup)
    await act(() => ($('[role="combobox"]') as HTMLElement).click())
    await waitFor(() => isShown($('#popup') as HTMLElement))
    await act(() => ($('#item-banana') as HTMLElement).click())
    expect(seen).toEqual(['banana'])
  })

  it('clears server errors on change', async (t) => {
    addStyle(t, BASE_CSS)
    let { $, act, cleanup } = render(
      <form.Context errors={{ fruit: 'Sold out' }}>
        <field.Context name="fruit">
          <FieldSelect />
        </field.Context>
      </form.Context>,
    )
    t.after(cleanup)
    let trigger = $('[role="combobox"]') as HTMLElement
    expect(trigger.getAttribute('aria-invalid')).toBe('true')
    await act(() => trigger.click())
    await waitFor(() => isShown($('#popup') as HTMLElement))
    await act(() => ($('#item-apple') as HTMLElement).click())
    expect(trigger.hasAttribute('aria-invalid')).toBe(false)
  })

  it('tracks focus across the trigger and the popup', async (t) => {
    addStyle(t, BASE_CSS)
    let { $, act, cleanup } = render(
      <div>
        <field.Context>
          <FieldSelect />
        </field.Context>
        <button id="other">Other</button>
      </div>,
    )
    t.after(cleanup)
    let trigger = $('[role="combobox"]') as HTMLElement
    await act(() => trigger.focus())
    expect(trigger.hasAttribute('data-focused')).toBe(true)
    await act(() => key(trigger, 'ArrowDown'))
    await waitFor(() => isShown($('#popup') as HTMLElement))
    await waitFor(() => ($('#popup') as HTMLElement).contains(document.activeElement))
    await act(() => {})
    expect(trigger.hasAttribute('data-touched')).toBe(false)
    expect(trigger.hasAttribute('data-focused')).toBe(true)
    await act(() => key(document.activeElement!, 'Escape'))
    await waitFor(() => document.activeElement === trigger)
    await act(() => ($('#other') as HTMLElement).focus())
    expect(trigger.hasAttribute('data-touched')).toBe(true)
    expect(trigger.hasAttribute('data-focused')).toBe(false)
  })

  it('is disabled by the field or an enclosing fieldset', async (t) => {
    addStyle(t, BASE_CSS)
    let { $$, act, cleanup } = render(
      <div>
        <field.Context disabled>
          <FieldSelect />
        </field.Context>
        <fieldset.Context disabled>
          <FieldSelect />
        </fieldset.Context>
      </div>,
    )
    t.after(cleanup)
    let triggers = [...$$('[role="combobox"]')] as HTMLButtonElement[]
    for (let trigger of triggers) {
      expect(trigger.disabled).toBe(true)
      expect(trigger.hasAttribute('data-disabled')).toBe(true)
    }
    for (let input of [...$$('input')] as HTMLInputElement[]) expect(input.disabled).toBe(true)
    await act(() => triggers[0]!.click())
    expect(isShown([...$$('[data-test-popup]')][0] as HTMLElement)).toBe(false)
  })
})

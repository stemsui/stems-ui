// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/combobox.test.tsx).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'

import * as field from './field.ts'
import * as fieldset from './fieldset.ts'
import * as form from './form.ts'
import * as combobox from './combobox.tsx'
import {
  ComboboxChangeEvent,
  ComboboxInputChangeEvent,
  ComboboxOpenChangeEvent,
  onComboboxChange,
  onComboboxInputChange,
  onComboboxOpenChange,
} from './combobox.tsx'
import type {
  ComboboxInputChangeDetails,
  ComboboxOpenChangeDetails,
  ComboboxValueChangeDetails,
} from './combobox.tsx'

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

function key(target: Element, value: string, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value, ...init })
  target.dispatchEvent(event)
  return event
}

function type(input: HTMLInputElement, text: string, inputType = 'insertText') {
  input.value = text
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType }))
}

function isShown(element: HTMLElement) {
  return element.matches(':popover-open')
}

function pressOutside(target: Element) {
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

const FRUITS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'blueberry', label: 'Blueberry', disabled: true },
  { value: 'cherry', label: 'Cherry' },
  { value: 'creme', label: 'Crème brûlée' },
  { value: 'grape', label: 'Grape' },
]

type HarnessProps = combobox.ComboboxContextProps & {
  noArgs?: boolean
  withIndicators?: boolean
  withChips?: boolean
  grouped?: boolean
  extra?: RemixNode
}

function Items(handle: Handle<{ withIndicators?: boolean }>) {
  return () =>
    FRUITS.map((fruit) =>
      handle.props.withIndicators ? (
        <combobox.ItemContext value={fruit.value} disabled={fruit.disabled}>
          <div id={`item-${fruit.value}`} mix={combobox.item()}>
            {fruit.label}
            <span data-indicator={fruit.value} mix={combobox.itemIndicator()}>
              ✓
            </span>
          </div>
        </combobox.ItemContext>
      ) : (
        <div
          id={`item-${fruit.value}`}
          mix={combobox.item({ value: fruit.value, disabled: fruit.disabled })}
        >
          {fruit.label}
        </div>
      ),
    )
}

function Chips() {
  return () => (
    <combobox.ValueText>
      {(values: string[]) =>
        values.map((value) => (
          <span key={value} id={`chip-${value}`} mix={combobox.chip({ value })}>
            {value}
            <button id={`remove-${value}`} mix={combobox.chipRemove()}>
              ×
            </button>
          </span>
        ))
      }
    </combobox.ValueText>
  )
}

function Harness(handle: Handle<HarnessProps>) {
  return () => {
    let {
      noArgs,
      withIndicators,
      withChips,
      grouped,
      extra,
      children: _children,
      ...props
    } = handle.props
    return (
      <div>
        <combobox.Context {...props}>
          <div id="group" mix={combobox.inputGroup()}>
            {withChips ? (
              <div id="chips" mix={combobox.chips()}>
                <Chips />
                <input id="input" aria-label="Fruit" mix={combobox.input()} />
              </div>
            ) : (
              <input id="input" aria-label="Fruit" mix={combobox.input()} />
            )}
            <button
              id="clear"
              aria-label="Clear"
              mix={noArgs ? combobox.clear() : combobox.clear({})}
            >
              ×
            </button>
            <button
              id="trigger"
              aria-label="Open"
              mix={noArgs ? combobox.trigger() : combobox.trigger({})}
            >
              <span id="icon" mix={combobox.icon()}>
                ▾
              </span>
            </button>
          </div>
          <div id="popup" mix={noArgs ? combobox.popup() : combobox.popup({ sideOffset: 4 })}>
            <div id="empty" mix={combobox.empty()}>
              <combobox.EmptyText>No fruit found.</combobox.EmptyText>
            </div>
            <div id="list" mix={combobox.list()}>
              {grouped ? (
                <>
                  <div id="group-a" mix={combobox.group()}>
                    <div id="label-a" mix={combobox.groupLabel()}>
                      A
                    </div>
                    <div id="item-apple" mix={combobox.item({ value: 'apple' })}>
                      Apple
                    </div>
                  </div>
                  <div id="sep" mix={combobox.separator()} />
                  <div id="group-b" mix={combobox.group()}>
                    <div id="label-b" mix={combobox.groupLabel()}>
                      B
                    </div>
                    <div id="item-banana" mix={combobox.item({ value: 'banana' })}>
                      Banana
                    </div>
                    <div id="item-blueberry" mix={combobox.item({ value: 'blueberry' })}>
                      Blueberry
                    </div>
                  </div>
                </>
              ) : (
                <Items withIndicators={withIndicators} />
              )}
            </div>
          </div>
          {extra}
        </combobox.Context>
        <button id="outside">Outside</button>
      </div>
    )
  }
}

function setup(t: T, props: HarnessProps = {}) {
  let result = render(<Harness {...props} />)
  t.after(result.cleanup)
  let get = (id: string) => result.$(`#${id}`) as HTMLElement
  return {
    ...result,
    input: get('input') as HTMLInputElement,
    popup: get('popup'),
    list: get('list'),
    trigger: get('trigger') as HTMLButtonElement,
    clearButton: get('clear') as HTMLButtonElement,
    group: get('group'),
    empty: get('empty'),
    get,
    item: (value: string) => get(`item-${value}`),
    visibleItems: () =>
      [...result.container.querySelectorAll<HTMLElement>('[role="option"]')]
        .filter((node) => !node.hidden)
        .map((node) => node.id.replace('item-', '')),
  }
}

function setupControlled(
  t: T,
  options: {
    value?: unknown
    inputValue?: string
    open?: boolean
    accept?: boolean
    props?: HarnessProps
  } = {},
) {
  let state = { value: options.value ?? null, inputValue: options.inputValue, open: options.open }
  let values: Array<{ value: unknown; details: ComboboxValueChangeDetails }> = []
  let inputs: Array<{ value: string; details: ComboboxInputChangeDetails }> = []
  let opens: Array<{ open: boolean; details: ComboboxOpenChangeDetails }> = []
  let owner: Handle | undefined
  function App(handle: Handle) {
    owner = handle
    return () => (
      <Harness
        {...options.props}
        value={state.value}
        inputValue={'inputValue' in options ? state.inputValue : undefined}
        open={'open' in options ? state.open : undefined}
        onValueChange={(value, details) => {
          values.push({ value, details })
          if (options.accept === false) return
          state.value = value
          void handle.update()
        }}
        onInputValueChange={(value, details) => {
          inputs.push({ value, details })
          if (options.accept === false) return
          state.inputValue = value
          void handle.update()
        }}
        onOpenChange={(open, details) => {
          opens.push({ open, details })
          if (options.accept === false) return
          state.open = open
          void handle.update()
        }}
      />
    )
  }
  let result = render(<App />)
  t.after(result.cleanup)
  let get = (id: string) => result.$(`#${id}`) as HTMLElement
  return {
    ...result,
    input: get('input') as HTMLInputElement,
    popup: get('popup'),
    item: (value: string) => get(`item-${value}`),
    values,
    inputs,
    opens,
    async set(next: Partial<typeof state>) {
      Object.assign(state, next)
      await result.act(() => owner!.update())
    },
  }
}

describe('combobox', () => {
  it('renders ARIA and the closed state', (t) => {
    let { input, popup, list, trigger, clearButton, group, empty, get, item } = setup(t)

    expect(input.getAttribute('role')).toBe('combobox')
    expect(input.getAttribute('aria-autocomplete')).toBe('list')
    expect(input.getAttribute('aria-haspopup')).toBe('listbox')
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(input.getAttribute('aria-controls')).toBe(list.id)
    expect(input.hasAttribute('aria-activedescendant')).toBe(false)
    expect(input.getAttribute('autocomplete')).toBe('off')
    expect(input.value).toBe('')
    expect(input.hasAttribute('data-popup-open')).toBe(false)

    expect(group.getAttribute('role')).toBe('group')
    expect(group.getAttribute('data-placeholder')).toBe('')

    expect(trigger.getAttribute('type')).toBe('button')
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('tabindex')).toBe('-1')
    expect(trigger.getAttribute('data-placeholder')).toBe('')
    expect(get('icon').getAttribute('aria-hidden')).toBe('true')

    expect(clearButton.hidden).toBe(true)
    expect(clearButton.hasAttribute('data-visible')).toBe(false)

    expect(popup.getAttribute('popover')).toBe('manual')
    expect(popup.hidden).toBe(true)
    expect(popup.getAttribute('data-closed')).toBe('')
    expect(popup.hasAttribute('data-empty')).toBe(false)
    expect(list.getAttribute('role')).toBe('listbox')
    expect(list.getAttribute('tabindex')).toBe('-1')

    expect(empty.getAttribute('role')).toBe('status')
    expect(empty.getAttribute('aria-live')).toBe('polite')
    expect(empty.textContent).toBe('')

    let apple = item('apple')
    expect(apple.getAttribute('role')).toBe('option')
    expect(apple.getAttribute('aria-selected')).toBe('false')
    expect(apple.hasAttribute('tabindex')).toBe(false)
    expect(item('blueberry').getAttribute('aria-disabled')).toBe('true')
    expect(item('blueberry').getAttribute('data-disabled')).toBe('')
  })

  it('works with no-argument mixin calls', async (t) => {
    let { act, input, popup, trigger } = setup(t, { noArgs: true })
    expect(input.getAttribute('role')).toBe('combobox')
    await act(() => trigger.click())
    expect(isShown(popup)).toBe(true)
  })

  it('shows the defaultValue label in the input and submits the value', (t) => {
    let {
      input,
      item,
      container: root,
      group,
    } = setup(t, { defaultValue: 'cherry', name: 'fruit' })
    expect(input.value).toBe('Cherry')
    expect(item('cherry').getAttribute('aria-selected')).toBe('true')
    expect(item('cherry').getAttribute('data-selected')).toBe('')
    expect(group.hasAttribute('data-placeholder')).toBe(false)
    let hidden = root.querySelector('input[name="fruit"]') as HTMLInputElement
    expect(hidden.value).toBe('cherry')
    expect(hidden.getAttribute('aria-hidden')).toBe('true')
  })

  it('uses defaultInputValue as the initial text', (t) => {
    let { input, visibleItems } = setup(t, { defaultInputValue: 'an' })
    expect(input.value).toBe('an')
    expect(visibleItems()).toEqual(['banana'])
  })

  it('typing opens the popup, filters items, and keeps focus in the input', async (t) => {
    let { act, input, popup, visibleItems } = setup(t)
    input.focus()
    await act(() => type(input, 'e'))
    expect(isShown(popup)).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-expanded')).toBe('true')
    expect(input.getAttribute('data-popup-open')).toBe('')
    expect(input.hasAttribute('aria-activedescendant')).toBe(false)
    // Case-insensitive "contains".
    expect(visibleItems()).toEqual(['apple', 'blueberry', 'cherry', 'creme', 'grape'])

    await act(() => type(input, 'BR'))
    expect(visibleItems()).toEqual(['creme'])
  })

  it('ignores diacritics when filtering', async (t) => {
    let { act, input, visibleItems } = setup(t)
    input.focus()
    await act(() => type(input, 'creme brulee'))
    expect(visibleItems()).toEqual(['creme'])
  })

  it('keeps the popup open with an empty state when nothing matches', async (t) => {
    let { act, input, popup, list, empty, trigger } = setup(t)
    input.focus()
    await act(() => type(input, 'zzz'))
    await act(() => nextFrame())
    expect(isShown(popup)).toBe(true)
    expect(popup.getAttribute('data-empty')).toBe('')
    expect(list.getAttribute('data-empty')).toBe('')
    expect(input.getAttribute('data-list-empty')).toBe('')
    expect(trigger.getAttribute('data-list-empty')).toBe('')
    expect(empty.getAttribute('data-empty')).toBe('')
    expect(empty.textContent).toBe('No fruit found.')

    await act(() => type(input, 'a'))
    await act(() => nextFrame())
    expect(popup.hasAttribute('data-empty')).toBe(false)
    expect(empty.textContent).toBe('')
  })

  it('ArrowDown opens and highlights; arrows move the active descendant through the input', async (t) => {
    let { act, input, popup, item } = setup(t)
    input.focus()
    await act(() => key(input, 'ArrowDown'))
    await act(() => nextFrame())
    expect(isShown(popup)).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-activedescendant')).toBe(item('apple').id)
    expect(item('apple').getAttribute('data-highlighted')).toBe('')

    await act(() => key(input, 'ArrowDown'))
    expect(input.getAttribute('aria-activedescendant')).toBe(item('banana').id)
    // The disabled item is skipped.
    await act(() => key(input, 'ArrowDown'))
    expect(input.getAttribute('aria-activedescendant')).toBe(item('cherry').id)

    await act(() => key(input, 'ArrowUp'))
    await act(() => key(input, 'ArrowUp'))
    expect(input.getAttribute('aria-activedescendant')).toBe(item('apple').id)
    // Past the first item, the highlight returns to the input…
    await act(() => key(input, 'ArrowUp'))
    expect(input.hasAttribute('aria-activedescendant')).toBe(false)
    // …and the next ArrowUp wraps to the last item.
    await act(() => key(input, 'ArrowUp'))
    expect(input.getAttribute('aria-activedescendant')).toBe(item('grape').id)
    await act(() => key(input, 'ArrowDown'))
    expect(input.hasAttribute('aria-activedescendant')).toBe(false)
  })

  it('ArrowUp opens on the last item; loopFocus={false} stops at the ends', async (t) => {
    let { act, input, item } = setup(t, { loopFocus: false })
    input.focus()
    await act(() => key(input, 'ArrowUp'))
    await act(() => nextFrame())
    expect(input.getAttribute('aria-activedescendant')).toBe(item('grape').id)
    await act(() => key(input, 'ArrowDown'))
    expect(input.getAttribute('aria-activedescendant')).toBe(item('grape').id)
  })

  it('Home and End stay with the input', async (t) => {
    let { act, input } = setup(t)
    input.focus()
    await act(() => key(input, 'ArrowDown'))
    await act(() => nextFrame())
    let event = key(input, 'End')
    expect(event.defaultPrevented).toBe(false)
  })

  it('Enter selects the highlighted item, fills the input, and closes', async (t) => {
    let { act, input, popup, item, container: root } = setup(t, { name: 'fruit' })
    let events: ComboboxChangeEvent[] = []
    root.addEventListener('stems:combobox-change', (event) => events.push(event))
    input.focus()
    await act(() => type(input, 'ch'))
    await act(() => key(input, 'ArrowDown'))
    expect(input.getAttribute('aria-activedescendant')).toBe(item('cherry').id)

    let event = await act(() => key(input, 'Enter'))
    void event
    expect(input.value).toBe('Cherry')
    await waitFor(() => !isShown(popup))
    expect(document.activeElement).toBe(input)
    expect((root.querySelector('input[name="fruit"]') as HTMLInputElement).value).toBe('cherry')
    expect(events.length).toBe(1)
    expect(events[0]).toBeInstanceOf(ComboboxChangeEvent)
    expect(events[0].value).toBe('cherry')
    expect(events[0].reason).toBe('item-press')

    // Reopening lists every item: the input shows the selected label.
    await act(() => key(input, 'ArrowDown'))
    await act(() => nextFrame())
    expect(input.getAttribute('aria-activedescendant')).toBe(item('cherry').id)
    expect(item('apple').hidden).toBe(false)
  })

  it('Enter without a highlighted item does nothing', async (t) => {
    let { act, input, popup } = setup(t)
    input.focus()
    await act(() => type(input, 'a'))
    let event = key(input, 'Enter')
    expect(event.defaultPrevented).toBe(false)
    expect(isShown(popup)).toBe(true)
  })

  it('pressing an item selects it and keeps focus in the input', async (t) => {
    let { act, input, popup, item } = setup(t)
    input.focus()
    await act(() => type(input, 'gr'))
    let down = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    item('grape').dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)
    await act(() => item('grape').click())
    expect(input.value).toBe('Grape')
    await waitFor(() => !isShown(popup))
    expect(document.activeElement).toBe(input)
  })

  it('pressing a disabled item does nothing', async (t) => {
    let { act, input, popup, item } = setup(t)
    input.focus()
    await act(() => type(input, 'blue'))
    await act(() => item('blueberry').click())
    expect(input.value).toBe('blue')
    expect(isShown(popup)).toBe(true)
  })

  it('on blur the input text resets to the selected label', async (t) => {
    let { act, input, get } = setup(t, { defaultValue: 'apple' })
    input.focus()
    await act(() => type(input, 'zz'))
    await act(() => get('outside').focus())
    expect(input.value).toBe('Apple')
  })

  it('on blur without a selection the free text is cleared', async (t) => {
    let { act, input, get, popup } = setup(t)
    input.focus()
    await act(() => type(input, 'zz'))
    await act(() => get('outside').focus())
    await waitFor(() => !isShown(popup))
    expect(input.value).toBe('')
  })

  it('Escape closes the popup and restores the selected label', async (t) => {
    let { act, input, popup } = setup(t, { defaultValue: 'banana' })
    input.focus()
    await act(() => type(input, 'gr'))
    expect(isShown(popup)).toBe(true)
    await act(() => key(input, 'Escape'))
    await waitFor(() => !isShown(popup))
    expect(input.value).toBe('Banana')
    expect(document.activeElement).toBe(input)
  })

  it('an outside press closes the popup', async (t) => {
    let { act, input, popup, get } = setup(t)
    input.focus()
    await act(() => type(input, 'a'))
    await act(() => pressOutside(get('outside')))
    await waitFor(() => !isShown(popup))
  })

  it('pressing the input group does not dismiss the popup', async (t) => {
    let { act, input, popup, group } = setup(t)
    input.focus()
    await act(() => type(input, 'a'))
    await act(() => pressOutside(group))
    expect(isShown(popup)).toBe(true)
  })

  it('clearing the text clears the value', async (t) => {
    let { act, input, container: root } = setup(t, { defaultValue: 'apple', name: 'fruit' })
    let reasons: string[] = []
    root.addEventListener('stems:combobox-change', (event) => reasons.push(event.reason))
    input.focus()
    await act(() => type(input, '', 'deleteContentBackward'))
    expect((root.querySelector('input[name="fruit"]') as HTMLInputElement).value).toBe('')
    expect(reasons).toEqual(['input-clear'])
  })

  it('clicking the input opens the popup and highlights the selected item', async (t) => {
    let { act, input, popup, item } = setup(t, { defaultValue: 'cherry' })
    input.focus()
    await act(() => input.click())
    await act(() => nextFrame())
    expect(isShown(popup)).toBe(true)
    expect(input.getAttribute('aria-activedescendant')).toBe(item('cherry').id)
  })

  it('openOnInputClick={false} keeps the popup closed on click', async (t) => {
    let { act, input, popup } = setup(t, { openOnInputClick: false })
    await act(() => input.click())
    await waitFor(() => !isShown(popup))
  })

  it('the trigger toggles the popup and keeps focus in the input', async (t) => {
    let { act, input, popup, trigger, get } = setup(t)
    input.focus()
    let down = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    trigger.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)
    await act(() => trigger.click())
    expect(isShown(popup)).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.getAttribute('data-popup-open')).toBe('')
    expect(get('icon').getAttribute('data-popup-open')).toBe('')
    expect(document.activeElement).toBe(input)
    await act(() => trigger.click())
    await waitFor(() => !isShown(popup))
  })

  it('the clear button clears the value and the text', async (t) => {
    let { act, input, clearButton } = setup(t, { defaultValue: 'apple' })
    expect(clearButton.hidden).toBe(false)
    expect(clearButton.getAttribute('data-visible')).toBe('')
    expect(clearButton.getAttribute('tabindex')).toBe('-1')
    let reasons: string[] = []
    input.addEventListener('stems:combobox-change', (event) => reasons.push(event.reason))
    await act(() => clearButton.click())
    await act(() => nextFrame())
    expect(input.value).toBe('')
    expect(reasons).toEqual(['clear-press'])
    expect(document.activeElement).toBe(input)
    expect(clearButton.hasAttribute('data-visible')).toBe(false)
  })

  it('reports input text changes with reasons and events', async (t) => {
    let { act, input, item } = setup(t)
    let log: string[] = []
    input.addEventListener('stems:combobox-input-change', (event) => {
      expect(event).toBeInstanceOf(ComboboxInputChangeEvent)
      log.push(`${event.inputValue}:${event.reason}`)
    })
    input.focus()
    await act(() => type(input, 'ap'))
    await act(() => item('apple').click())
    expect(log).toEqual(['ap:input-change', 'Apple:item-press'])
  })

  it('reports open changes with reasons and events', async (t) => {
    let { act, input, get } = setup(t)
    let log: string[] = []
    input.addEventListener('stems:combobox-open-change', (event) => {
      expect(event).toBeInstanceOf(ComboboxOpenChangeEvent)
      log.push(`${event.open}:${event.reason}`)
    })
    input.focus()
    await act(() => type(input, 'a'))
    await act(() => key(input, 'Escape'))
    await act(() => key(input, 'ArrowDown'))
    await act(() => get('outside').focus())
    await act(() => input.click())
    expect(log).toEqual([
      'true:input-change',
      'false:escape-key',
      'true:list-navigation',
      'false:focus-out',
      'true:input-press',
    ])
  })

  it('listener helpers receive the events', async (t) => {
    let changes: unknown[] = []
    let inputs: string[] = []
    let opens: boolean[] = []
    let result = render(
      <div
        mix={[
          onComboboxChange((event) => void changes.push(event.value)),
          onComboboxInputChange((event) => void inputs.push(event.inputValue)),
          onComboboxOpenChange((event) => void opens.push(event.open)),
        ]}
      >
        <Harness />
      </div>,
    )
    t.after(result.cleanup)
    let input = result.$('#input') as HTMLInputElement
    input.focus()
    await result.act(() => type(input, 'gr'))
    await result.act(() => (result.$('#item-grape') as HTMLElement).click())
    expect(changes).toEqual(['grape'])
    expect(inputs).toEqual(['gr', 'Grape'])
    expect(opens).toEqual([true, false])
  })

  it('supports a controlled value', async (t) => {
    let { act, input, item, values, set } = setupControlled(t, { value: 'banana' })
    expect(input.value).toBe('Banana')
    input.focus()
    await act(() => type(input, 'ch'))
    await act(() => item('cherry').click())
    expect(values.map((entry) => entry.value)).toEqual(['cherry'])
    expect(values[0].details.reason).toBe('item-press')
    expect(input.value).toBe('Cherry')

    // An external change shows the new label.
    await set({ value: 'grape' })
    expect(input.value).toBe('Grape')
    expect(item('grape').getAttribute('aria-selected')).toBe('true')
  })

  it('a canceled value change keeps the value', async (t) => {
    let result = render(
      <Harness defaultValue="apple" onValueChange={(_value, details) => details.cancel()} />,
    )
    t.after(result.cleanup)
    let input = result.$('#input') as HTMLInputElement
    input.focus()
    await result.act(() => type(input, 'gr'))
    await result.act(() => (result.$('#item-grape') as HTMLElement).click())
    expect((result.$('#item-apple') as HTMLElement).getAttribute('aria-selected')).toBe('true')
    expect((result.$('#popup') as HTMLElement).matches(':popover-open')).toBe(true)
  })

  it('supports a controlled input value', async (t) => {
    let { act, input, inputs, set, popup } = setupControlled(t, { inputValue: 'ap' })
    expect(input.value).toBe('ap')
    input.focus()
    await act(() => type(input, 'app'))
    expect(inputs.at(-1)!.value).toBe('app')
    expect(inputs.at(-1)!.details.reason).toBe('input-change')
    expect(input.value).toBe('app')
    expect(isShown(popup)).toBe(true)
    await set({ inputValue: 'gr' })
    expect(input.value).toBe('gr')
  })

  it('a rejected controlled input value keeps the input text', async (t) => {
    let { act, input, inputs } = setupControlled(t, { inputValue: 'ap', accept: false })
    input.focus()
    await act(() => type(input, 'apx'))
    await act(() => nextFrame())
    expect(inputs.length).toBe(1)
    expect(input.value).toBe('ap')
  })

  it('supports a controlled open state', async (t) => {
    let { act, input, popup, opens, set } = setupControlled(t, { open: false })
    input.focus()
    await act(() => key(input, 'ArrowDown'))
    expect(opens.map((entry) => `${entry.open}:${entry.details.reason}`)).toEqual([
      'true:list-navigation',
    ])
    expect(isShown(popup)).toBe(true)
    await set({ open: false })
    await waitFor(() => !isShown(popup))
  })

  it('canceling an open change keeps the popup closed', async (t) => {
    let result = render(<Harness onOpenChange={(_open, details) => details.cancel()} />)
    t.after(result.cleanup)
    let input = result.$('#input') as HTMLInputElement
    input.focus()
    await result.act(() => type(input, 'a'))
    expect((result.$('#popup') as HTMLElement).matches(':popover-open')).toBe(false)
  })

  it('autoHighlight highlights the first match while filtering', async (t) => {
    let { act, input, item } = setup(t, { autoHighlight: true })
    input.focus()
    await act(() => type(input, 'r'))
    await act(() => nextFrame())
    expect(input.getAttribute('aria-activedescendant')).toBe(item('cherry').id)
    await act(() => type(input, 'gr'))
    await act(() => nextFrame())
    expect(input.getAttribute('aria-activedescendant')).toBe(item('grape').id)
    await act(() => key(input, 'Enter'))
    expect(input.value).toBe('Grape')
  })

  it('typing clears the highlight without autoHighlight', async (t) => {
    let { act, input } = setup(t)
    input.focus()
    await act(() => key(input, 'ArrowDown'))
    await act(() => nextFrame())
    expect(input.hasAttribute('aria-activedescendant')).toBe(true)
    await act(() => type(input, 'b'))
    await act(() => nextFrame())
    expect(input.hasAttribute('aria-activedescendant')).toBe(false)
  })

  it('filter={null} shows every item; a custom filter is used', async (t) => {
    let first = setup(t, { filter: null })
    first.input.focus()
    await first.act(() => type(first.input, 'zzz'))
    expect(first.visibleItems().length).toBe(FRUITS.length)
    first.cleanup()

    let second = setup(t, {
      filter: (item: string, query: string) => item.startsWith(query.toLowerCase()),
    })
    second.input.focus()
    await second.act(() => type(second.input, 'B'))
    expect(second.visibleItems()).toEqual(['banana', 'blueberry'])
  })

  it('hides groups whose items all filtered out', async (t) => {
    let { act, input, get } = setup(t, { grouped: true })
    input.focus()
    await act(() => type(input, 'ban'))
    await act(() => nextFrame())
    expect(get('group-a').hidden).toBe(true)
    expect(get('group-b').hidden).toBe(false)
    expect(get('group-b').getAttribute('role')).toBe('group')
    expect(get('group-b').getAttribute('aria-labelledby')).toBe(get('label-b').id)
    expect(get('sep').getAttribute('role')).toBe('separator')
    await act(() => type(input, ''))
    await act(() => nextFrame())
    expect(get('group-a').hidden).toBe(false)
  })

  it('shows item indicators for selected items', async (t) => {
    let {
      act,
      input,
      container: root,
      item,
    } = setup(t, { withIndicators: true, defaultValue: 'banana' })
    let indicator = (value: string) =>
      root.querySelector(`[data-indicator="${value}"]`) as HTMLElement
    expect(indicator('banana').hidden).toBe(false)
    expect(indicator('banana').getAttribute('aria-hidden')).toBe('true')
    expect(indicator('apple').hidden).toBe(true)
    input.focus()
    await act(() => type(input, 'app'))
    await act(() => item('apple').click())
    await act(() => nextFrame())
    expect(indicator('apple').hidden).toBe(false)
  })

  it('disabled: no interaction, disabled input', async (t) => {
    let { act, input, popup, trigger, group } = setup(t, { disabled: true })
    expect(input.disabled).toBe(true)
    expect(input.getAttribute('data-disabled')).toBe('')
    expect(group.getAttribute('data-disabled')).toBe('')
    expect(trigger.disabled).toBe(true)
    await act(() => trigger.click())
    await act(() => key(input, 'ArrowDown'))
    await waitFor(() => !isShown(popup))
  })

  it('readOnly: the popup does not open', async (t) => {
    let { act, input, popup, trigger } = setup(t, { readOnly: true, defaultValue: 'apple' })
    expect(input.readOnly).toBe(true)
    expect(input.getAttribute('data-readonly')).toBe('')
    await act(() => trigger.click())
    await act(() => input.click())
    await act(() => key(input, 'ArrowDown'))
    await waitFor(() => !isShown(popup))
  })

  it('participates in forms and native validation', async (t) => {
    let result = render(
      <form id="form">
        <Harness name="fruit" required />
      </form>,
    )
    t.after(result.cleanup)
    let form = result.$('#form') as HTMLFormElement
    let input = result.$('#input') as HTMLInputElement
    expect(input.getAttribute('aria-required')).toBe('true')
    expect(input.getAttribute('data-required')).toBe('')
    expect(form.checkValidity()).toBe(false)
    input.focus()
    await result.act(() => type(input, 'ban'))
    await result.act(() => (result.$('#item-banana') as HTMLElement).click())
    expect(form.checkValidity()).toBe(true)
    expect([...new FormData(form).entries()]).toEqual([['fruit', 'banana']])
  })

  it('focusing the hidden form input focuses the combobox input', (t) => {
    let { container: root, input } = setup(t, { name: 'fruit' })
    ;(root.querySelector('input[name="fruit"]') as HTMLInputElement).focus()
    expect(document.activeElement).toBe(input)
  })

  it('uses object values with itemToStringLabel and itemToStringValue', async (t) => {
    let people = [
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Grace' },
    ]
    let result = render(
      <form id="form">
        <combobox.Context
          name="person"
          defaultValue={people[1]}
          itemToStringLabel={(person: { name: string }) => person.name}
          itemToStringValue={(person: { id: number }) => String(person.id)}
        >
          <input id="input" mix={combobox.input()} />
          <div mix={combobox.popup()}>
            <div mix={combobox.list()}>
              {people.map((person) => (
                <div id={`p-${person.id}`} mix={combobox.item({ value: person })}>
                  {person.name}
                </div>
              ))}
            </div>
          </div>
        </combobox.Context>
      </form>,
    )
    t.after(result.cleanup)
    let input = result.$('#input') as HTMLInputElement
    let form = result.$('#form') as HTMLFormElement
    expect(input.value).toBe('Grace')
    expect([...new FormData(form).entries()]).toEqual([['person', '2']])
    input.focus()
    await result.act(() => type(input, 'ad'))
    expect((result.$('#p-2') as HTMLElement).hidden).toBe(true)
    await result.act(() => (result.$('#p-1') as HTMLElement).click())
    expect(input.value).toBe('Ada')
    expect([...new FormData(form).entries()]).toEqual([['person', '1']])
  })

  it('renders filteredItems with Collection', async (t) => {
    let groups = [
      { value: 'Fruits', items: ['Apple', 'Banana'] },
      { value: 'Vegetables', items: ['Bean', 'Carrot'] },
    ]
    let result = render(
      <combobox.Context items={groups}>
        <input id="input" mix={combobox.input()} />
        <div id="popup" mix={combobox.popup()}>
          <div mix={combobox.empty()}>
            <combobox.EmptyText>Nothing</combobox.EmptyText>
          </div>
          <div id="list" mix={combobox.list()}>
            <combobox.Collection>
              {(group: { value: string; items: string[] }) => (
                <div class="group" data-group={group.value} mix={combobox.group()}>
                  <div mix={combobox.groupLabel()}>{group.value}</div>
                  <combobox.Collection items={group.items}>
                    {(item: string) => (
                      <div class="item" mix={combobox.item({ value: item })}>
                        {item}
                      </div>
                    )}
                  </combobox.Collection>
                </div>
              )}
            </combobox.Collection>
          </div>
        </div>
      </combobox.Context>,
    )
    t.after(result.cleanup)
    let input = result.$('#input') as HTMLInputElement
    let texts = () =>
      [...result.container.querySelectorAll('.item')].map((node) => node.textContent)
    expect(texts()).toEqual(['Apple', 'Banana', 'Bean', 'Carrot'])
    input.focus()
    await result.act(() => type(input, 'b'))
    expect(texts()).toEqual(['Banana', 'Bean'])
    await result.act(() => type(input, 'car'))
    expect(texts()).toEqual(['Carrot'])
    expect(result.container.querySelectorAll('.group').length).toBe(1)
    await result.act(() => type(input, 'zz'))
    expect(texts()).toEqual([])
    expect((result.$('#popup') as HTMLElement).getAttribute('data-empty')).toBe('')
    expect(result.container.textContent).toContain('Nothing')
    await result.act(() => key(input, 'ArrowDown'))
  })

  it('limits filteredItems', async (t) => {
    let result = render(
      <combobox.Context items={['a1', 'a2', 'a3', 'b1']} limit={2}>
        <input id="input" mix={combobox.input()} />
        <div mix={combobox.popup()}>
          <div mix={combobox.list()}>
            <combobox.Collection>
              {(item: string) => (
                <div class="item" mix={combobox.item({ value: item })}>
                  {item}
                </div>
              )}
            </combobox.Collection>
          </div>
        </div>
      </combobox.Context>,
    )
    t.after(result.cleanup)
    expect(result.container.querySelectorAll('.item').length).toBe(2)
  })

  describe('multiple', () => {
    it('toggles values, clears the text, closes, and renders chips', async (t) => {
      let {
        act,
        input,
        popup,
        list,
        item,
        get,
        container: root,
      } = setup(t, {
        multiple: true,
        withChips: true,
        name: 'fruits',
      })
      expect(list.getAttribute('aria-multiselectable')).toBe('true')
      input.focus()
      await act(() => type(input, 'ap'))
      await act(() => item('apple').click())
      expect(input.value).toBe('')
      await waitFor(() => !isShown(popup))
      expect(get('chip-apple').textContent).toContain('apple')

      await act(() => type(input, 'gr'))
      await act(() => key(input, 'ArrowDown'))
      await act(() => key(input, 'Enter'))
      expect(get('chip-grape')).not.toBe(null)
      let hidden = [...root.querySelectorAll<HTMLInputElement>('input[type="hidden"]')]
      expect(hidden.map((node) => [node.name, node.value])).toEqual([
        ['fruits', 'apple'],
        ['fruits', 'grape'],
      ])

      // Pressing a selected item deselects it.
      await act(() => key(input, 'ArrowDown'))
      await act(() => nextFrame())
      await act(() => item('apple').click())
      expect(root.querySelector('#chip-apple')).toBe(null)
    })

    it('keeps new chips before the input (Remix reconciler workaround)', async (t) => {
      let { act, input, item, get } = setup(t, {
        multiple: true,
        withChips: true,
        defaultValue: ['apple'],
      })
      input.focus()
      await act(() => type(input, 'gr'))
      await act(() => item('grape').click())
      await act(() => type(input, 'ban'))
      await act(() => item('banana').click())
      let order = [...get('chips').children].map((node) => node.id)
      expect(order).toEqual(['chip-apple', 'chip-grape', 'chip-banana', 'input'])
    })

    it('Backspace in the empty input removes the last chip', async (t) => {
      let {
        act,
        input,
        container: root,
      } = setup(t, {
        multiple: true,
        withChips: true,
        defaultValue: ['apple', 'cherry'],
      })
      input.focus()
      let event = await act(() => key(input, 'Backspace'))
      void event
      expect(root.querySelector('#chip-cherry')).toBe(null)
      expect(root.querySelector('#chip-apple')).not.toBe(null)
    })

    it('arrow keys move between chips; Backspace and Delete remove them', async (t) => {
      let {
        act,
        input,
        get,
        container: root,
      } = setup(t, {
        multiple: true,
        withChips: true,
        defaultValue: ['apple', 'banana', 'cherry'],
      })
      input.focus()
      input.setSelectionRange(0, 0)
      await act(() => key(input, 'ArrowLeft'))
      expect(document.activeElement).toBe(get('chip-cherry'))
      expect(get('chip-cherry').getAttribute('tabindex')).toBe('-1')
      await act(() => key(get('chip-cherry'), 'ArrowLeft'))
      expect(document.activeElement).toBe(get('chip-banana'))
      await act(() => key(get('chip-banana'), 'ArrowRight'))
      await act(() => key(get('chip-cherry'), 'ArrowRight'))
      expect(document.activeElement).toBe(input)

      input.setSelectionRange(0, 0)
      await act(() => key(input, 'ArrowLeft'))
      await act(() => key(get('chip-cherry'), 'ArrowLeft'))
      await act(() => key(get('chip-banana'), 'Backspace'))
      expect(root.querySelector('#chip-banana')).toBe(null)
      expect(document.activeElement).toBe(get('chip-apple'))
      await act(() => key(get('chip-apple'), 'Delete'))
      expect(document.activeElement).toBe(get('chip-cherry'))
    })

    it('the chip remove button removes its value', async (t) => {
      let {
        act,
        get,
        container: root,
        input,
      } = setup(t, {
        multiple: true,
        withChips: true,
        defaultValue: ['apple', 'banana'],
      })
      let remove = get('remove-apple') as HTMLButtonElement
      expect(remove.getAttribute('type')).toBe('button')
      expect(remove.getAttribute('tabindex')).toBe('-1')
      let reasons: string[] = []
      input.addEventListener('stems:combobox-change', (event) => reasons.push(event.reason))
      await act(() => remove.click())
      expect(root.querySelector('#chip-apple')).toBe(null)
      expect(reasons).toEqual(['chip-remove-press'])
      expect(document.activeElement).toBe(input)
    })

    it('the clear button clears every value', async (t) => {
      let {
        act,
        clearButton,
        container: root,
      } = setup(t, {
        multiple: true,
        withChips: true,
        defaultValue: ['apple', 'banana'],
      })
      await act(() => clearButton.click())
      expect(root.querySelectorAll('[id^="chip-"]').length).toBe(0)
    })

    it('a canceled item-press close keeps the popup open for more picks', async (t) => {
      let result = render(
        <Harness
          multiple
          withChips
          onOpenChange={(open, details) => {
            if (!open && details.reason === 'item-press') details.cancel()
          }}
        />,
      )
      t.after(result.cleanup)
      let input = result.$('#input') as HTMLInputElement
      input.focus()
      await result.act(() => type(input, 'a'))
      await result.act(() => (result.$('#item-apple') as HTMLElement).click())
      await result.act(() => (result.$('#item-banana') as HTMLElement).click())
      expect((result.$('#popup') as HTMLElement).matches(':popover-open')).toBe(true)
      expect(result.$('#chip-apple')).not.toBe(null)
      expect(result.$('#chip-banana')).not.toBe(null)
    })
  })

  it('supports the input inside the popup', async (t) => {
    let result = render(
      <combobox.Context>
        <button id="trigger" mix={combobox.trigger()}>
          <span mix={combobox.value()}>
            <combobox.ValueText placeholder="Pick" />
          </span>
        </button>
        <div id="popup" mix={combobox.popup()}>
          <input id="input" mix={combobox.input()} />
          <div mix={combobox.list()}>
            <div id="item-a" mix={combobox.item({ value: 'a' })}>
              Alpha
            </div>
            <div id="item-b" mix={combobox.item({ value: 'b' })}>
              Beta
            </div>
          </div>
        </div>
      </combobox.Context>,
    )
    t.after(result.cleanup)
    let trigger = result.$('#trigger') as HTMLButtonElement
    let input = result.$('#input') as HTMLInputElement
    let popup = result.$('#popup') as HTMLElement
    expect(trigger.hasAttribute('tabindex')).toBe(false)
    trigger.focus()
    await result.act(() => trigger.click())
    await waitFor(() => document.activeElement === input)
    await result.act(() => type(input, 'be'))
    await result.act(() => key(input, 'ArrowDown'))
    await result.act(() => key(input, 'Enter'))
    await waitFor(() => !isShown(popup))
    expect(trigger.textContent).toBe('Beta')
    await waitFor(() => document.activeElement === trigger)
  })

  it('modal locks scroll and makes outside content inert', async (t) => {
    let { act, input, get } = setup(t, { modal: true })
    input.focus()
    await act(() => type(input, 'a'))
    await act(() => nextFrame())
    expect(get('outside').closest('[inert]')).not.toBe(null)
    expect(input.closest('[inert]')).toBe(null)
    await act(() => key(input, 'Escape'))
    expect(get('outside').closest('[inert]')).toBe(null)
  })
})

function submitForm(formNode: Element) {
  formNode.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
}

describe('combobox in a field', () => {
  it('is labelled, described and named by the field', async (t) => {
    let { $, act, cleanup } = render(
      <field.Context name="fruit">
        <label mix={field.label()}>Fruit</label>
        <Harness name="ignored" defaultValue="apple" />
        <p id="description" mix={field.description()}>
          Pick one
        </p>
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let input = $('#input') as HTMLInputElement
    // The input's own id becomes the field's control id.
    expect(($('label') as HTMLLabelElement).htmlFor).toBe('input')
    expect(input.getAttribute('aria-describedby')).toBe('description')
    let hidden = $('input[aria-hidden="true"]') as HTMLInputElement
    expect(hidden.name).toBe('fruit')
    expect(hidden.value).toBe('apple')
    for (let id of ['input', 'group', 'trigger']) {
      expect($(`#${id}`)!.hasAttribute('data-filled')).toBe(true)
      expect($(`#${id}`)!.hasAttribute('data-dirty')).toBe(false)
    }
  })

  it('blocks a required combobox, focuses the input and re-validates on change', async (t) => {
    let submitted: form.FormValues[] = []
    let { $, act, cleanup } = render(
      <form.Context onFormSubmit={(values) => void submitted.push(values)}>
        <form mix={form.root()}>
          <field.Context name="fruit">
            <Harness required />
            <div id="error" mix={field.error({ match: 'valueMissing' })}>
              Pick a fruit
            </div>
          </field.Context>
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    let input = $('#input') as HTMLInputElement
    await act(() => submitForm($('form')!))
    expect(submitted).toEqual([])
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe('error')
    expect($('#group')!.hasAttribute('data-invalid')).toBe(true)

    await act(() => type(input, 'Che'))
    await waitFor(() => isShown($('#popup') as HTMLElement))
    await act(() => ($('#item-cherry') as HTMLElement).click())
    expect(input.hasAttribute('data-valid')).toBe(true)
    expect(input.hasAttribute('data-dirty')).toBe(true)
    await act(() => submitForm($('form')!))
    expect(submitted).toEqual([{ fruit: 'cherry' }])
  })

  it('validates a multiple value and clears server errors on change', async (t) => {
    let seen: unknown[] = []
    let { $, act, cleanup } = render(
      <form.Context errors={{ fruits: 'Out of stock' }}>
        <field.Context
          name="fruits"
          validationMode="onChange"
          validate={(value) => {
            seen.push(value)
            return null
          }}
        >
          <Harness multiple withChips defaultValue={['apple']} />
        </field.Context>
      </form.Context>,
    )
    t.after(cleanup)
    let input = $('#input') as HTMLInputElement
    expect(input.getAttribute('aria-invalid')).toBe('true')
    await act(() => ($('#remove-apple') as HTMLElement).click())
    expect(seen).toEqual([[]])
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(input.hasAttribute('data-filled')).toBe(false)
  })

  it('stays focused while focus moves inside the widget', async (t) => {
    let { $, act, cleanup } = render(
      <field.Context>
        <Harness multiple withChips defaultValue={['apple', 'banana']} />
      </field.Context>,
    )
    t.after(cleanup)
    let input = $('#input') as HTMLInputElement
    await act(() => input.focus())
    expect(input.hasAttribute('data-focused')).toBe(true)
    // Focus moves to a chip and back: not a blur of the field.
    await act(() => ($('#chip-banana') as HTMLElement).focus())
    await act(() => input.focus())
    expect(input.hasAttribute('data-touched')).toBe(false)
    await act(() => ($('#outside') as HTMLElement).focus())
    expect(input.hasAttribute('data-focused')).toBe(false)
    expect(input.hasAttribute('data-touched')).toBe(true)
  })

  it('is disabled by the field or an enclosing fieldset', async (t) => {
    for (let wrap of ['field', 'fieldset'] as const) {
      let tree = <Harness name="fruit" />
      let { $, act, cleanup } = render(
        wrap === 'field' ? (
          <field.Context disabled>{tree}</field.Context>
        ) : (
          <fieldset.Context disabled>{tree}</fieldset.Context>
        ),
      )
      let input = $('#input') as HTMLInputElement
      expect(input.disabled).toBe(true)
      expect(($('input[aria-hidden="true"]') as HTMLInputElement).disabled).toBe(true)
      expect($('#group')!.hasAttribute('data-disabled')).toBe(true)
      await act(() => ($('#trigger') as HTMLElement).click())
      expect(isShown($('#popup') as HTMLElement)).toBe(false)
      cleanup()
    }
  })
})

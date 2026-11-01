// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/listbox.test.tsx).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { createMixin, on } from 'remix/component'
import type { ElementProps, Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'

import {
  createListboxGroup,
  createListboxGroupLabel,
  createListboxItem,
  createListboxList,
  createListboxStore,
  markItemText,
} from './listbox.ts'
import type {
  ListboxFocusMode,
  ListboxItemOptions,
  ListboxStateProps,
  ListboxStore,
  ListboxValueChangeDetails,
} from './listbox.ts'

type T = { after(fn: () => void): void }

class TestChangeEvent extends Event {
  constructor(readonly value: unknown) {
    super('test:listbox-change', { bubbles: true })
  }
}

// A minimal widget built on the core, the way select and combobox use it.
type ProviderProps = ListboxStateProps & { focusMode?: ListboxFocusMode; children?: RemixNode }

function TestListbox(handle: Handle<ProviderProps, ListboxStore>) {
  let store = createListboxStore({
    id: handle.id,
    getProps: () => handle.props,
    update: () => handle.update(),
    focusMode: handle.props.focusMode ?? 'roving',
    createChangeEvent: (value) => new TestChangeEvent(value),
  })
  handle.context.set(store)
  return () => handle.props.children
}

function getStore(handle: { context: { get(provider: unknown): unknown } }) {
  return handle.context.get(TestListbox) as ListboxStore
}

const list = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let store = getStore(handle)
  let part = createListboxList(handle, store, { activeDescendant: store.focusMode === 'virtual' })
  return (props) => [
    part.render(props),
    store.focusMode === 'roving' &&
      on<HTMLElement, 'keydown'>('keydown', (event) => void store.onKeyDown(event)),
  ]
})

const option = createMixin<HTMLElement, [options: ListboxItemOptions], ElementProps>(
  (handle, hostType) => {
    let core = createListboxItem(handle, hostType, getStore(handle))
    return (options, props) => core.render(options, props)
  },
)

const group = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let part = createListboxGroup(handle)
  return (props) => part.render(props)
})

const groupLabel = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let part = createListboxGroupLabel(handle)
  return (props) => part.render(props)
})

const itemText = createMixin<HTMLElement, [], ElementProps>((handle) => {
  handle.addEventListener('insert', (event) => markItemText(event.node))
  return () => undefined
})

// Combobox-style input: keeps DOM focus and points at the highlighted option.
function VirtualInput(handle: Handle) {
  let store = getStore(handle)
  return () => (
    <input
      id="input"
      role="combobox"
      aria-controls={store.listId}
      aria-activedescendant={store.highlightedId}
      mix={on<HTMLInputElement, 'keydown'>(
        'keydown',
        (event) => void store.onKeyDown(event, { typeahead: false }),
      )}
    />
  )
}

const FRAMEWORKS = [
  { value: 'remix', label: 'Remix' },
  { value: 'react-router', label: 'React Router', disabled: true },
  { value: 'react', label: 'React' },
  { value: 'preact', label: 'Preact' },
  { value: 'svelte', label: 'Svelte' },
]

function Options() {
  return () =>
    FRAMEWORKS.map((item) => (
      <div id={`opt-${item.value}`} mix={option({ value: item.value, disabled: item.disabled })}>
        {item.label}
      </div>
    ))
}

function setup(t: T, props: ProviderProps = {}, extra?: RemixNode) {
  let changes: Array<{ value: unknown; details: ListboxValueChangeDetails }> = []
  let events: unknown[] = []
  let result = render(
    <div
      mix={on(
        'test:listbox-change' as 'change',
        (event) => void events.push((event as unknown as TestChangeEvent).value),
      )}
    >
      <TestListbox onValueChange={(value, details) => changes.push({ value, details })} {...props}>
        {props.focusMode === 'virtual' ? <VirtualInput /> : null}
        <div id="list" aria-label="Frameworks" mix={list()}>
          <Options />
          {extra}
        </div>
      </TestListbox>
    </div>,
  )
  t.after(result.cleanup)
  let get = (id: string) => result.$(`#${id}`) as HTMLElement
  return { ...result, get, opt: (v: string) => get(`opt-${v}`), changes, events }
}

function key(target: Element, value: string) {
  let event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value })
  target.dispatchEvent(event)
  return event
}

function pointer(target: Element, type: string, init: PointerEventInit = {}) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'mouse', ...init }))
}

function Controlled(
  handle: Handle<{ initial: unknown; multiple?: boolean; accept?: boolean; log: unknown[] }>,
) {
  let value = handle.props.initial
  return () => (
    <TestListbox
      value={value}
      multiple={handle.props.multiple}
      onValueChange={(next) => {
        handle.props.log.push(next)
        if (handle.props.accept === false) return
        value = next
        void handle.update()
      }}
    >
      <div id="list" mix={list()}>
        <Options />
      </div>
    </TestListbox>
  )
}

describe('lib/listbox', () => {
  it('renders listbox roles, ids, and string aria-selected', (t) => {
    let { get, opt } = setup(t, { defaultValue: 'react' })
    let listbox = get('list')
    expect(listbox.getAttribute('role')).toBe('listbox')
    expect(listbox.getAttribute('tabindex')).toBe('-1')
    expect(listbox.hasAttribute('aria-multiselectable')).toBe(false)
    expect(opt('remix').getAttribute('role')).toBe('option')
    expect(opt('remix').getAttribute('aria-selected')).toBe('false')
    expect(opt('react').getAttribute('aria-selected')).toBe('true')
    expect(opt('react').getAttribute('data-selected')).toBe('')
    expect(opt('react-router').getAttribute('aria-disabled')).toBe('true')
    expect(opt('react-router').getAttribute('data-disabled')).toBe('')
    expect(opt('remix').hasAttribute('data-highlighted')).toBe(false)
    expect(opt('remix').getAttribute('tabindex')).toBe('-1')
  })

  it('generates option ids when the host has none', (t) => {
    let result = render(
      <TestListbox>
        <div mix={list()}>
          <div mix={option({ value: 'a' })}>A</div>
        </div>
      </TestListbox>,
    )
    t.after(result.cleanup)
    let node = result.$('[role="option"]') as HTMLElement
    expect(node.id).not.toBe('')
    let listbox = result.$('[role="listbox"]') as HTMLElement
    expect(listbox.id).not.toBe('')
  })

  it('selects on click (uncontrolled) and reports change details and events', async (t) => {
    let { act, opt, changes, events } = setup(t)
    await act(() => opt('preact').click())
    expect(changes.map((c) => [c.value, c.details.reason])).toEqual([['preact', 'item-press']])
    expect(events).toEqual(['preact'])
    expect(opt('preact').getAttribute('aria-selected')).toBe('true')
    // Selecting the selected value again is a no-op in single mode.
    await act(() => opt('preact').click())
    expect(changes.length).toBe(1)
  })

  it('ignores clicks on disabled options', async (t) => {
    let { act, opt, changes } = setup(t)
    await act(() => opt('react-router').click())
    expect(changes).toEqual([])
    expect(opt('react-router').getAttribute('aria-selected')).toBe('false')
  })

  it('does not change controlled selection until the owner re-renders', async (t) => {
    let log: unknown[] = []
    let result = render(<Controlled initial="remix" accept={false} log={log} />)
    t.after(result.cleanup)
    let react = result.$('#opt-react') as HTMLElement
    await result.act(() => react.click())
    expect(log).toEqual(['react'])
    expect(react.getAttribute('aria-selected')).toBe('false')
    expect((result.$('#opt-remix') as HTMLElement).getAttribute('aria-selected')).toBe('true')
  })

  it('applies accepted controlled changes', async (t) => {
    let log: unknown[] = []
    let result = render(<Controlled initial="remix" log={log} />)
    t.after(result.cleanup)
    let react = result.$('#opt-react') as HTMLElement
    await result.act(() => react.click())
    expect(react.getAttribute('aria-selected')).toBe('true')
  })

  it('cancels a change with details.cancel()', async (t) => {
    let { act, opt } = setup(t, {
      defaultValue: 'remix',
      onValueChange: (_value, details) => details.cancel(),
    })
    await act(() => opt('react').click())
    expect(opt('remix').getAttribute('aria-selected')).toBe('true')
  })

  it('toggles values with multiple', async (t) => {
    let { act, get, opt, changes } = setup(t, { multiple: true, defaultValue: ['remix'] })
    expect(get('list').getAttribute('aria-multiselectable')).toBe('true')
    await act(() => opt('react').click())
    await act(() => opt('remix').click())
    expect(changes.map((c) => c.value)).toEqual([['remix', 'react'], ['react']])
    expect(opt('remix').getAttribute('aria-selected')).toBe('false')
    expect(opt('react').getAttribute('aria-selected')).toBe('true')
  })

  it('compares values with isItemEqualToValue', (t) => {
    let result = render(
      <TestListbox
        defaultValue={{ id: 2 }}
        isItemEqualToValue={(a: { id: number }, b: { id: number }) => a.id === b.id}
      >
        <div mix={list()}>
          <div id="one" mix={option({ value: { id: 1 } })}>
            One
          </div>
          <div id="two" mix={option({ value: { id: 2 } })}>
            Two
          </div>
        </div>
      </TestListbox>,
    )
    t.after(result.cleanup)
    expect((result.$('#two') as HTMLElement).getAttribute('aria-selected')).toBe('true')
    expect((result.$('#one') as HTMLElement).getAttribute('aria-selected')).toBe('false')
  })

  it('roving: arrows, Home and End move focus and skip disabled options', async (t) => {
    let { act, get, opt } = setup(t)
    let listbox = get('list')
    listbox.focus()
    let event: KeyboardEvent | undefined
    await act(() => {
      event = key(listbox, 'ArrowDown')
    })
    expect(event!.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(opt('remix'))
    expect(opt('remix').getAttribute('data-highlighted')).toBe('')
    await act(() => key(opt('remix'), 'ArrowDown'))
    expect(document.activeElement).toBe(opt('react'))
    await act(() => key(opt('react'), 'ArrowUp'))
    expect(document.activeElement).toBe(opt('remix'))
    await act(() => key(opt('remix'), 'End'))
    expect(document.activeElement).toBe(opt('svelte'))
    // loopFocus defaults to true in the core.
    await act(() => key(opt('svelte'), 'ArrowDown'))
    expect(document.activeElement).toBe(opt('remix'))
    await act(() => key(opt('remix'), 'Home'))
    expect(document.activeElement).toBe(opt('remix'))
  })

  it('ArrowUp with nothing highlighted goes to the last option; loopFocus: false stops', async (t) => {
    let { act, get, opt } = setup(t, { loopFocus: false })
    let listbox = get('list')
    await act(() => key(listbox, 'ArrowUp'))
    expect(document.activeElement).toBe(opt('svelte'))
    await act(() => key(opt('svelte'), 'ArrowDown'))
    expect(document.activeElement).toBe(opt('svelte'))
  })

  it('does not swallow Tab', (t) => {
    let { get } = setup(t)
    let event = key(get('list'), 'Tab')
    expect(event.defaultPrevented).toBe(false)
  })

  it('Enter and Space select the highlighted option', async (t) => {
    let { act, get, opt, changes } = setup(t)
    await act(() => key(get('list'), 'ArrowDown'))
    await act(() => key(opt('remix'), 'Enter'))
    expect(changes.at(-1)?.value).toBe('remix')
    await act(() => key(opt('remix'), 'ArrowDown'))
    await act(() => key(opt('react'), ' '))
    expect(changes.at(-1)?.value).toBe('react')
  })

  it('typeahead highlights without selecting and uses label / item text', async (t) => {
    let { act, get, opt, changes } = setup(
      t,
      {},
      <>
        <div id="opt-labelled" mix={option({ value: 'beta', label: 'Zeta' })}>
          Staging
        </div>
        <div id="opt-text" mix={option({ value: 'text' })}>
          <span aria-hidden="true">★</span>
          <span mix={itemText()}>Quasar</span>
        </div>
      </>,
    )
    await act(() => key(get('list'), 'p'))
    expect(document.activeElement).toBe(opt('preact'))
    expect(changes).toEqual([])
    await act(() => key(opt('preact'), 'z'))
    // "pz" doesn't match; wait for the buffer to clear.
    await new Promise((resolve) => setTimeout(resolve, 800))
    await act(() => key(opt('preact'), 'z'))
    expect(document.activeElement).toBe(opt('labelled'))
    await new Promise((resolve) => setTimeout(resolve, 800))
    await act(() => key(opt('labelled'), 'q'))
    expect(document.activeElement).toBe(opt('text'))
  })

  it('typeahead skips disabled options', async (t) => {
    let { act, get, opt } = setup(t)
    await act(() => key(get('list'), 'r'))
    expect(document.activeElement).toBe(opt('remix'))
    await act(() => key(opt('remix'), 'e'))
    await act(() => key(opt('remix'), 'a'))
    expect(document.activeElement).toBe(opt('react'))
  })

  it('pointer movement highlights enabled options; leaving clears a pointer highlight', async (t) => {
    let { act, get, opt } = setup(t)
    await act(() => pointer(opt('react'), 'pointermove'))
    expect(opt('react').getAttribute('data-highlighted')).toBe('')
    expect(document.activeElement).toBe(opt('react'))
    await act(() => pointer(opt('react'), 'pointerleave'))
    expect(opt('react').hasAttribute('data-highlighted')).toBe(false)
    expect(document.activeElement).toBe(get('list'))
    await act(() => pointer(opt('react-router'), 'pointermove'))
    expect(opt('react-router').hasAttribute('data-highlighted')).toBe(false)
  })

  it('highlightItemOnHover: false ignores the pointer', async (t) => {
    let { act, opt } = setup(t, { highlightItemOnHover: false })
    await act(() => pointer(opt('react'), 'pointermove'))
    expect(opt('react').hasAttribute('data-highlighted')).toBe(false)
  })

  it('reports highlight changes', async (t) => {
    let log: unknown[] = []
    let { act, get } = setup(t, {
      onItemHighlighted: (value, details) => log.push([value, details.reason]),
    })
    await act(() => key(get('list'), 'ArrowDown'))
    expect(log).toEqual([['remix', 'keyboard']])
  })

  it('scrolls the highlighted option into view', async (t) => {
    let calls: Element[] = []
    let original = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
      calls.push(this)
    }
    t.after(() => (HTMLElement.prototype.scrollIntoView = original))
    let { act, get, opt } = setup(t)
    await act(() => key(get('list'), 'End'))
    expect(calls).toContain(opt('svelte'))
  })

  it('skips hidden options', async (t) => {
    let result = render(
      <TestListbox>
        <div id="list" mix={list()}>
          <div id="a" mix={option({ value: 'a' })}>
            A
          </div>
          <div id="b" hidden mix={option({ value: 'b' })}>
            B
          </div>
          <div id="c" mix={option({ value: 'c' })}>
            C
          </div>
        </div>
      </TestListbox>,
    )
    t.after(result.cleanup)
    let listbox = result.$('#list') as HTMLElement
    await result.act(() => key(listbox, 'ArrowDown'))
    await result.act(() => key(result.$('#a') as HTMLElement, 'ArrowDown'))
    expect(document.activeElement).toBe(result.$('#c'))
  })

  it('labels groups with their group label', async (t) => {
    let result = render(
      <TestListbox>
        <div mix={list()}>
          <div id="g" mix={group()}>
            <div id="gl" mix={groupLabel()}>
              Meta
            </div>
            <div mix={option({ value: 'x' })}>X</div>
          </div>
        </div>
      </TestListbox>,
    )
    t.after(result.cleanup)
    await result.act(() => {})
    let node = result.$('#g') as HTMLElement
    expect(node.getAttribute('role')).toBe('group')
    expect(node.getAttribute('aria-labelledby')).toBe('gl')
  })

  it('virtual: keeps focus in the input and points aria-activedescendant at the highlight', async (t) => {
    let { act, get, opt, changes } = setup(t, { focusMode: 'virtual' })
    let field = get('input') as HTMLInputElement
    let listbox = get('list')
    field.focus()
    // The list registers its host id after the input rendered; a queued update syncs it.
    await act(() => {})
    expect(field.getAttribute('aria-controls')).toBe(listbox.id)
    expect(opt('remix').hasAttribute('tabindex')).toBe(false)

    await act(() => key(field, 'ArrowDown'))
    expect(document.activeElement).toBe(field)
    expect(field.getAttribute('aria-activedescendant')).toBe(opt('remix').id)
    expect(listbox.getAttribute('aria-activedescendant')).toBe(opt('remix').id)
    expect(opt('remix').getAttribute('data-highlighted')).toBe('')

    await act(() => key(field, 'ArrowDown'))
    expect(field.getAttribute('aria-activedescendant')).toBe(opt('react').id)

    // Typing (Space included) belongs to the input; Enter selects.
    let typed = key(field, 'p')
    expect(typed.defaultPrevented).toBe(false)
    let space = key(field, ' ')
    expect(space.defaultPrevented).toBe(false)
    expect(changes).toEqual([])
    await act(() => key(field, 'Enter'))
    expect(changes.at(-1)?.value).toBe('react')

    // Pressing an option doesn't blur the input.
    let mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    opt('svelte').dispatchEvent(mousedown)
    expect(mousedown.defaultPrevented).toBe(true)
    await act(() => pointer(opt('svelte'), 'pointermove'))
    expect(document.activeElement).toBe(field)
    expect(field.getAttribute('aria-activedescendant')).toBe(opt('svelte').id)
  })
})

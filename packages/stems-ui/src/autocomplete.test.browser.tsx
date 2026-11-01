import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'

import * as field from './field.ts'
import * as fieldset from './fieldset.ts'
import * as form from './form.ts'
import * as autocomplete from './autocomplete.tsx'
import {
  AutocompleteChangeEvent,
  AutocompleteOpenChangeEvent,
  onAutocompleteChange,
  onAutocompleteOpenChange,
} from './autocomplete.tsx'
import type { AutocompleteValueChangeDetails } from './autocomplete.tsx'

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

const TAGS = ['feature', 'fix', 'bug', 'docs', 'internal', 'component: dialog']

type HarnessProps = autocomplete.AutocompleteContextProps & {
  noArgs?: boolean
  extra?: RemixNode
}

function Harness(handle: Handle<HarnessProps>) {
  return () => {
    let { noArgs, extra, children: _children, ...props } = handle.props
    return (
      <div>
        <autocomplete.Context items={TAGS} {...props}>
          <div id="group" mix={autocomplete.inputGroup()}>
            <input id="input" aria-label="Tag" mix={autocomplete.input()} />
            <button
              id="clear"
              aria-label="Clear"
              mix={noArgs ? autocomplete.clear() : autocomplete.clear({})}
            >
              ×
            </button>
            <button
              id="trigger"
              aria-label="Open"
              mix={noArgs ? autocomplete.trigger() : autocomplete.trigger({})}
            >
              <span id="icon" mix={autocomplete.icon()} />
            </button>
          </div>
          <span id="value">
            <autocomplete.ValueText />
          </span>
          <div
            id="popup"
            mix={noArgs ? autocomplete.popup() : autocomplete.popup({ sideOffset: 4 })}
          >
            <div id="status" mix={autocomplete.status()} />
            <div id="empty" mix={autocomplete.empty()}>
              <autocomplete.EmptyText>No tags.</autocomplete.EmptyText>
            </div>
            <div id="list" mix={autocomplete.list()}>
              <autocomplete.Collection>
                {(tag: string) => (
                  <div
                    key={tag}
                    id={`item-${tag.replace(/\W+/g, '-')}`}
                    mix={autocomplete.item({ value: tag })}
                  >
                    {tag}
                  </div>
                )}
              </autocomplete.Collection>
            </div>
          </div>
          {extra}
        </autocomplete.Context>
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
    get,
    item: (value: string) => get(`item-${value}`),
    texts: () =>
      [...result.container.querySelectorAll<HTMLElement>('[role="option"]')].map(
        (node) => node.textContent,
      ),
  }
}

describe('autocomplete', () => {
  it('renders ARIA and the closed state', (t) => {
    let { input, popup, list } = setup(t)
    expect(input.getAttribute('role')).toBe('combobox')
    expect(input.getAttribute('aria-autocomplete')).toBe('list')
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(input.getAttribute('aria-controls')).toBe(list.id)
    expect(input.getAttribute('autocomplete')).toBe('off')
    expect(popup.hidden).toBe(true)
    expect(list.getAttribute('role')).toBe('listbox')
  })

  it('works with no-argument mixin calls', async (t) => {
    let { act, popup, trigger } = setup(t, { noArgs: true })
    await act(() => trigger.click())
    expect(isShown(popup)).toBe(true)
  })

  it('aria-autocomplete follows the mode', (t) => {
    let { input } = setup(t, { mode: 'both' })
    expect(input.getAttribute('aria-autocomplete')).toBe('both')
  })

  it('typing keeps free text, opens, and filters the suggestions', async (t) => {
    let { act, input, popup, texts, get } = setup(t)
    input.focus()
    await act(() => type(input, 'fi'))
    expect(isShown(popup)).toBe(true)
    expect(input.value).toBe('fi')
    expect(get('value').textContent).toBe('fi')
    expect(texts()).toEqual(['fix'])
    await act(() => type(input, 'UG'))
    expect(texts()).toEqual(['bug'])
  })

  it('keeps the popup open with an empty state', async (t) => {
    let { act, input, popup, get } = setup(t)
    input.focus()
    await act(() => type(input, 'zzz'))
    expect(isShown(popup)).toBe(true)
    expect(popup.getAttribute('data-empty')).toBe('')
    expect(get('empty').textContent).toBe('No tags.')
  })

  it('keeps free text on blur (it is the value)', async (t) => {
    let { act, input, popup, get } = setup(t, { name: 'tag' })
    input.focus()
    await act(() => type(input, 'something new'))
    await act(() => get('outside').focus())
    await waitFor(() => !isShown(popup))
    expect(input.value).toBe('something new')
    expect(input.name).toBe('tag')
  })

  it('pressing a suggestion fills the input and closes', async (t) => {
    let { act, input, popup, item } = setup(t)
    let events: AutocompleteChangeEvent[] = []
    input.addEventListener('stems:autocomplete-change', (event) => events.push(event))
    input.focus()
    await act(() => type(input, 'do'))
    await act(() => item('docs').click())
    expect(input.value).toBe('docs')
    expect(document.activeElement).toBe(input)
    await waitFor(() => !isShown(popup))
    expect(events.map((event) => `${event.value}:${event.reason}`)).toEqual([
      'do:input-change',
      'docs:item-press',
    ])
    expect(events[0]).toBeInstanceOf(AutocompleteChangeEvent)
    expect(item('docs').getAttribute('aria-selected')).toBe('false')
  })

  it('ArrowDown and Enter choose a suggestion', async (t) => {
    let { act, input, popup, item } = setup(t)
    input.focus()
    await act(() => key(input, 'ArrowDown'))
    await act(() => nextFrame())
    expect(isShown(popup)).toBe(true)
    expect(input.getAttribute('aria-activedescendant')).toBe(item('feature').id)
    // mode="list" doesn't change the text while navigating.
    expect(input.value).toBe('')
    await act(() => key(input, 'ArrowDown'))
    let enter = await act(() => key(input, 'Enter'))
    void enter
    expect(input.value).toBe('fix')
  })

  it('Enter without a highlighted suggestion is left to the form', async (t) => {
    let { act, input } = setup(t)
    input.focus()
    await act(() => type(input, 'f'))
    expect(key(input, 'Enter').defaultPrevented).toBe(false)
  })

  it('Escape closes the popup, then clears the text', async (t) => {
    let { act, input, popup } = setup(t)
    input.focus()
    await act(() => type(input, 'fe'))
    await act(() => key(input, 'Escape'))
    await waitFor(() => !isShown(popup))
    expect(input.value).toBe('fe')
    let reasons: string[] = []
    input.addEventListener('stems:autocomplete-change', (event) => reasons.push(event.reason))
    await act(() => key(input, 'Escape'))
    expect(input.value).toBe('')
    expect(reasons).toEqual(['escape-key'])
  })

  it('does not open on input click by default', async (t) => {
    let first = setup(t)
    await first.act(() => first.input.click())
    expect(isShown(first.popup)).toBe(false)
    first.cleanup()
    let second = setup(t, { openOnInputClick: true })
    await second.act(() => second.input.click())
    expect(isShown(second.popup)).toBe(true)
  })

  it('mode="none" and mode="inline" do not filter', async (t) => {
    let { act, input, texts } = setup(t, { mode: 'none' })
    input.focus()
    await act(() => type(input, 'zzz'))
    expect(texts().length).toBe(TAGS.length)
  })

  it('mode="both" completes the highlighted suggestion inline', async (t) => {
    let { act, input, item } = setup(t, { mode: 'both' })
    input.focus()
    await act(() => type(input, 'f'))
    await act(() => key(input, 'ArrowDown'))
    expect(input.getAttribute('aria-activedescendant')).toBe(item('feature').id)
    expect(input.value).toBe('feature')
    // The typed prefix stays, the completed remainder is selected.
    expect(input.selectionStart).toBe(1)
    expect(input.selectionEnd).toBe(7)

    await act(() => key(input, 'ArrowDown'))
    expect(input.value).toBe('fix')
    // Back to the input: the typed text returns.
    await act(() => key(input, 'ArrowDown'))
    expect(input.hasAttribute('aria-activedescendant')).toBe(false)
    expect(input.value).toBe('f')
  })

  it('mode="both": Escape reverts the completion, Enter commits it', async (t) => {
    let { act, input, popup } = setup(t, { mode: 'both' })
    let values: string[] = []
    input.addEventListener('stems:autocomplete-change', (event) => values.push(event.value))
    input.focus()
    await act(() => type(input, 'b'))
    await act(() => key(input, 'ArrowDown'))
    expect(input.value).toBe('bug')
    await act(() => key(input, 'Escape'))
    await waitFor(() => !isShown(popup))
    expect(input.value).toBe('b')

    await act(() => key(input, 'ArrowDown'))
    await act(() => nextFrame())
    expect(input.value).toBe('bug')
    await act(() => key(input, 'Enter'))
    expect(input.value).toBe('bug')
    expect(values).toEqual(['b', 'bug'])
  })

  it('mode="both": leaving the input keeps the completion', async (t) => {
    let { act, input, get } = setup(t, { mode: 'both' })
    let values: string[] = []
    input.addEventListener('stems:autocomplete-change', (event) => values.push(event.value))
    input.focus()
    await act(() => type(input, 'd'))
    await act(() => key(input, 'ArrowDown'))
    await act(() => get('outside').focus())
    await act(() => nextFrame())
    expect(input.value).toBe('docs')
    expect(values).toEqual(['d', 'docs'])
  })

  it('autoHighlight with mode="both" completes while typing, not while deleting', async (t) => {
    let { act, input } = setup(t, { mode: 'both', autoHighlight: true })
    input.focus()
    await act(() => type(input, 'in'))
    await act(() => nextFrame())
    expect(input.value).toBe('internal')
    expect(input.selectionStart).toBe(2)
    expect(input.selectionEnd).toBe(8)
    await act(() => type(input, 'i', 'deleteContentBackward'))
    await act(() => nextFrame())
    expect(input.value).toBe('i')
  })

  it('drops aria-activedescendant when the highlighted suggestion unmounts', async (t) => {
    let { act, input } = setup(t, { autoHighlight: true })
    input.focus()
    await act(() => type(input, 'fe'))
    await act(() => nextFrame())
    expect(input.hasAttribute('aria-activedescendant')).toBe(true)
    await act(() => type(input, 'fex'))
    await act(() => nextFrame())
    expect(input.hasAttribute('aria-activedescendant')).toBe(false)
  })

  it("autoHighlight='always' keeps the first suggestion highlighted", async (t) => {
    let { act, input, trigger, item } = setup(t, { autoHighlight: 'always' })
    input.focus()
    await act(() => trigger.click())
    await act(() => nextFrame())
    expect(input.getAttribute('aria-activedescendant')).toBe(item('feature').id)
  })

  it('supports a controlled value', async (t) => {
    let changes: Array<{ value: string; details: AutocompleteValueChangeDetails }> = []
    let state = { value: 'fe' }
    let owner: Handle | undefined
    function App(handle: Handle) {
      owner = handle
      return () => (
        <Harness
          value={state.value}
          onValueChange={(value, details) => {
            changes.push({ value, details })
            state.value = value
            void handle.update()
          }}
        />
      )
    }
    let result = render(<App />)
    t.after(result.cleanup)
    let input = result.$('#input') as HTMLInputElement
    expect(input.value).toBe('fe')
    input.focus()
    await result.act(() => type(input, 'fea'))
    expect(changes.map((change) => change.details.reason)).toEqual(['input-change'])
    state.value = 'docs'
    await result.act(() => owner!.update())
    expect(input.value).toBe('docs')
  })

  it('a canceled change keeps the text', async (t) => {
    let result = render(<Harness defaultValue="ab" onValueChange={(_v, d) => d.cancel()} />)
    t.after(result.cleanup)
    let input = result.$('#input') as HTMLInputElement
    input.focus()
    await result.act(() => type(input, 'abc'))
    await result.act(() => nextFrame())
    expect(input.value).toBe('ab')
  })

  it('participates in forms through the input', async (t) => {
    let submits = 0
    let result = render(
      <form
        id="form"
        mix={on<HTMLFormElement, 'submit'>('submit', (event) => {
          event.preventDefault()
          submits++
        })}
      >
        <Harness name="tag" required submitOnItemClick />
      </form>,
    )
    t.after(result.cleanup)
    let form = result.$('#form') as HTMLFormElement
    let input = result.$('#input') as HTMLInputElement
    expect(input.required).toBe(true)
    expect(form.checkValidity()).toBe(false)
    input.focus()
    await result.act(() => type(input, 'bu'))
    expect([...new FormData(form).entries()]).toEqual([['tag', 'bu']])
    await result.act(() => (result.$('#item-bug') as HTMLElement).click())
    await result.act(() => nextFrame())
    expect([...new FormData(form).entries()]).toEqual([['tag', 'bug']])
    expect(submits).toBe(1)
  })

  it('the clear button clears the text', async (t) => {
    let { act, input, clearButton } = setup(t, { defaultValue: 'docs' })
    expect(clearButton.hidden).toBe(false)
    await act(() => clearButton.click())
    expect(input.value).toBe('')
    expect(document.activeElement).toBe(input)
  })

  it('reports open changes', async (t) => {
    let opens: string[] = []
    let changes: string[] = []
    let result = render(
      <div
        mix={[
          onAutocompleteOpenChange((event) => {
            expect(event).toBeInstanceOf(AutocompleteOpenChangeEvent)
            opens.push(`${event.open}:${event.reason}`)
          }),
          onAutocompleteChange((event) => void changes.push(event.value)),
        ]}
      >
        <Harness />
      </div>,
    )
    t.after(result.cleanup)
    let input = result.$('#input') as HTMLInputElement
    input.focus()
    await result.act(() => type(input, 'f'))
    await result.act(() => (result.$('#item-fix') as HTMLElement).click())
    expect(opens).toEqual(['true:input-change', 'false:item-press'])
    expect(changes).toEqual(['f', 'fix'])
  })

  it('works with registered items and object suggestions', async (t) => {
    let people = [
      { id: 1, name: 'Ada Lovelace' },
      { id: 2, name: 'Grace Hopper' },
    ]
    let result = render(
      <autocomplete.Context itemToStringValue={(person: { name: string }) => person.name}>
        <input id="input" mix={autocomplete.input()} />
        <div mix={autocomplete.popup()}>
          <div mix={autocomplete.list()}>
            {people.map((person) => (
              <div id={`p-${person.id}`} mix={autocomplete.item({ value: person })}>
                {person.name}
              </div>
            ))}
          </div>
        </div>
      </autocomplete.Context>,
    )
    t.after(result.cleanup)
    let input = result.$('#input') as HTMLInputElement
    input.focus()
    await result.act(() => type(input, 'hop'))
    expect((result.$('#p-1') as HTMLElement).hidden).toBe(true)
    await result.act(() => (result.$('#p-2') as HTMLElement).click())
    expect(input.value).toBe('Grace Hopper')
  })

  it('disabled and readOnly', async (t) => {
    let first = setup(t, { disabled: true })
    expect(first.input.disabled).toBe(true)
    await first.act(() => first.trigger.click())
    expect(isShown(first.popup)).toBe(false)
    first.cleanup()
    let second = setup(t, { readOnly: true })
    expect(second.input.readOnly).toBe(true)
    await second.act(() => key(second.input, 'ArrowDown'))
    expect(isShown(second.popup)).toBe(false)
  })

  it('status is a polite live region', (t) => {
    let { get } = setup(t)
    expect(get('status').getAttribute('role')).toBe('status')
    expect(get('status').getAttribute('aria-live')).toBe('polite')
  })
})

function submitForm(formNode: Element) {
  formNode.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
}

describe('autocomplete in a field', () => {
  it('is labelled, described and named by the field like a plain input', async (t) => {
    let { $, act, cleanup } = render(
      <field.Context name="tag">
        <label mix={field.label()}>Tag</label>
        <Harness name="ignored" />
        <p id="description" mix={field.description()}>
          Any tag
        </p>
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let input = $('#input') as HTMLInputElement
    expect(($('label') as HTMLLabelElement).htmlFor).toBe('input')
    expect(input.name).toBe('tag')
    expect(input.getAttribute('aria-describedby')).toBe('description')
    await act(() => type(input, 'fe'))
    expect(input.hasAttribute('data-filled')).toBe(true)
    expect(input.hasAttribute('data-dirty')).toBe(true)
    expect($('#group')!.hasAttribute('data-dirty')).toBe(true)
  })

  it('blocks a required autocomplete and validates the text of a pressed item', async (t) => {
    let submitted: form.FormValues[] = []
    let { $, act, cleanup } = render(
      <form.Context onFormSubmit={(values) => void submitted.push(values)}>
        <form mix={form.root()}>
          <field.Context
            name="tag"
            validate={(value) => (value === 'bug' ? 'No bugs allowed' : null)}
          >
            <Harness required />
            <div id="error" mix={field.error()}>
              <field.Validity>{(state) => state.error}</field.Validity>
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

    await act(() => type(input, 'bu'))
    await waitFor(() => isShown($('#popup') as HTMLElement))
    await act(() => ($('#item-bug') as HTMLElement).click())
    expect(input.value).toBe('bug')
    expect($('#error')!.textContent).toBe('No bugs allowed')
    await act(() => type(input, 'docs'))
    expect(input.hasAttribute('data-valid')).toBe(true)
    await act(() => submitForm($('form')!))
    expect(submitted).toEqual([{ tag: 'docs' }])
  })

  it('clears server errors on change and tracks touched', async (t) => {
    let { $, act, cleanup } = render(
      <form.Context errors={{ tag: 'Unknown tag' }}>
        <field.Context name="tag">
          <Harness />
        </field.Context>
      </form.Context>,
    )
    t.after(cleanup)
    let input = $('#input') as HTMLInputElement
    expect(input.getAttribute('aria-invalid')).toBe('true')
    await act(() => input.focus())
    await act(() => type(input, 'f'))
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    await act(() => ($('#outside') as HTMLElement).focus())
    expect(input.hasAttribute('data-touched')).toBe(true)
  })

  it('is disabled by the field or an enclosing fieldset', (t) => {
    let { $$, cleanup } = render(
      <div>
        <field.Context disabled>
          <Harness />
        </field.Context>
        <fieldset.Context disabled>
          <Harness />
        </fieldset.Context>
      </div>,
    )
    t.after(cleanup)
    for (let input of [...$$('[role=combobox]')] as HTMLInputElement[]) {
      expect(input.disabled).toBe(true)
    }
  })
})

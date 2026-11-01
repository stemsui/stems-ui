import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { createRoot, on, type Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as radio from './radio.ts'
import * as radioGroup from './radio-group.ts'
import * as field from './field.ts'
import * as fieldset from './fieldset.ts'
import * as form from './form.ts'

function Radio(
  handle: Handle<{ value: string; disabled?: boolean; host?: 'span' | 'button'; id?: string }>,
) {
  return () => {
    let { value, disabled, host = 'span', id } = handle.props
    let Host = host
    return (
      <label>
        <radio.Context value={value} disabled={disabled} id={id}>
          <Host data-value={value} mix={radio.root()}>
            <span mix={radio.indicator()} />
          </Host>
        </radio.Context>
        {value}
      </label>
    )
  }
}

function key(target: Element, value: string) {
  let event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value })
  target.dispatchEvent(event)
  return event
}

function radios(container: Element) {
  return [...container.querySelectorAll('[role="radio"]')] as HTMLElement[]
}

function summary(container: Element) {
  return radios(container).map(
    (node) =>
      `${node.getAttribute('data-value')}:${node.getAttribute('aria-checked')}:${node.getAttribute('tabindex')}`,
  )
}

const storage = ['ssd', 'hdd', 'nvme']

describe('radio-group', () => {
  it('renders radiogroup and radio semantics with a roving tab stop', (t) => {
    let { $, container, cleanup } = render(
      <radioGroup.Context>
        <div aria-label="Storage" mix={radioGroup.root()}>
          {storage.map((value) => (
            <Radio value={value} />
          ))}
        </div>
      </radioGroup.Context>,
    )
    t.after(cleanup)

    let group = $('[role="radiogroup"]') as HTMLElement
    expect(group.hasAttribute('aria-orientation')).toBe(false)
    expect(group.hasAttribute('data-disabled')).toBe(false)
    // Nothing selected: the first radio is the tab stop.
    expect(summary(container)).toEqual(['ssd:false:0', 'hdd:false:-1', 'nvme:false:-1'])

    let [first] = radios(container)
    let indicator = first!.firstElementChild as HTMLElement
    expect(first!.getAttribute('data-unchecked')).toBe('')
    expect(indicator.hidden).toBe(true)
    expect(indicator.getAttribute('data-unchecked')).toBe('')

    let inputs = [...container.querySelectorAll('input[type="radio"]')] as HTMLInputElement[]
    expect(inputs.length).toBe(3)
    expect(inputs.every((input) => input.tabIndex === -1)).toBe(true)
    expect(inputs.every((input) => input.getAttribute('aria-hidden') === 'true')).toBe(true)
  })

  it('makes the selected radio the tab stop, even when it renders later', (t) => {
    let { container, cleanup } = render(
      <radioGroup.Context defaultValue="nvme">
        <div aria-label="Storage" mix={radioGroup.root()}>
          {storage.map((value) => (
            <Radio value={value} />
          ))}
        </div>
      </radioGroup.Context>,
    )
    t.after(cleanup)

    expect(summary(container)).toEqual(['ssd:false:-1', 'hdd:false:-1', 'nvme:true:0'])
  })

  it('falls back to the first enabled radio when the value matches none', async (t) => {
    let { act, container, cleanup } = render(
      <radioGroup.Context defaultValue="missing">
        <div aria-label="Storage" mix={radioGroup.root()}>
          <Radio value="ssd" disabled />
          <Radio value="hdd" />
        </div>
      </radioGroup.Context>,
    )
    t.after(cleanup)
    await act(() => Promise.resolve())

    expect(summary(container)).toEqual(['ssd:false:null', 'hdd:false:0'])
  })

  it('selects on click (uncontrolled) and dispatches change events', async (t) => {
    let changes: string[] = []
    let events: radioGroup.RadioGroupChangeEvent[] = []
    let { act, container, cleanup } = render(
      <radioGroup.Context defaultValue="ssd" onValueChange={(value) => void changes.push(value)}>
        <div
          aria-label="Storage"
          mix={[
            radioGroup.root(),
            radioGroup.onRadioGroupChange((event) => void events.push(event)),
          ]}
        >
          {storage.map((value) => (
            <Radio value={value} />
          ))}
        </div>
      </radioGroup.Context>,
    )
    t.after(cleanup)

    let [, hdd] = radios(container)
    await act(() => hdd!.click())

    expect(summary(container)).toEqual(['ssd:false:-1', 'hdd:true:0', 'nvme:false:-1'])
    expect(hdd!.getAttribute('data-checked')).toBe('')
    expect((hdd!.firstElementChild as HTMLElement).hidden).toBe(false)
    expect(changes).toEqual(['hdd'])
    expect(events.length).toBe(1)
    expect(events[0]).toBeInstanceOf(radioGroup.RadioGroupChangeEvent)
    expect(events[0]?.value).toBe('hdd')
    expect(events[0]?.target).toBe(hdd)

    // Clicking the selected radio again does nothing.
    await act(() => hdd!.click())
    expect(changes).toEqual(['hdd'])
  })

  it('moves focus and selection with the arrow keys, skipping disabled radios and looping', async (t) => {
    let changes: string[] = []
    let { act, container, cleanup } = render(
      <radioGroup.Context defaultValue="a" onValueChange={(value) => void changes.push(value)}>
        <div aria-label="Letters" mix={radioGroup.root()}>
          <Radio value="a" />
          <Radio value="b" disabled />
          <Radio value="c" />
          <Radio value="d" />
        </div>
      </radioGroup.Context>,
    )
    t.after(cleanup)

    let [a, , c, d] = radios(container)
    a!.focus()

    let event = key(a!, 'ArrowDown')
    expect(event.defaultPrevented).toBe(true)
    await act(() => Promise.resolve())
    expect(document.activeElement).toBe(c)
    expect(changes).toEqual(['c'])

    await act(() => key(c!, 'ArrowRight'))
    expect(document.activeElement).toBe(d)
    await act(() => key(d!, 'ArrowRight'))
    expect(document.activeElement).toBe(a)
    await act(() => key(a!, 'ArrowUp'))
    expect(document.activeElement).toBe(d)
    await act(() => key(d!, 'ArrowLeft'))
    expect(document.activeElement).toBe(c)

    expect(changes).toEqual(['c', 'd', 'a', 'd', 'c'])
    expect(summary(container)).toEqual(['a:false:-1', 'b:false:null', 'c:true:0', 'd:false:-1'])

    // Other keys are left alone.
    expect(key(c!, 'Home').defaultPrevented).toBe(false)
    expect(key(c!, 'a').defaultPrevented).toBe(false)
  })

  it('mirrors horizontal arrows in RTL', async (t) => {
    let changes: string[] = []
    let { act, container, cleanup } = render(
      <div dir="rtl">
        <radioGroup.Context defaultValue="a" onValueChange={(value) => void changes.push(value)}>
          <div aria-label="Letters" mix={radioGroup.root()}>
            <Radio value="a" />
            <Radio value="b" />
          </div>
        </radioGroup.Context>
      </div>,
    )
    t.after(cleanup)

    let [a, b] = radios(container)
    a!.focus()
    await act(() => key(a!, 'ArrowLeft'))
    expect(document.activeElement).toBe(b)
    await act(() => key(b!, 'ArrowRight'))
    expect(document.activeElement).toBe(a)
    expect(changes).toEqual(['b', 'a'])
  })

  it('selects with Space on a span host and ignores Enter', async (t) => {
    let changes: string[] = []
    let { act, container, cleanup } = render(
      <radioGroup.Context onValueChange={(value) => void changes.push(value)}>
        <div aria-label="Storage" mix={radioGroup.root()}>
          {storage.map((value) => (
            <Radio value={value} />
          ))}
        </div>
      </radioGroup.Context>,
    )
    t.after(cleanup)

    let [, hdd] = radios(container)
    expect(key(hdd!, 'Enter').defaultPrevented).toBe(true)
    expect(key(hdd!, ' ').defaultPrevented).toBe(true)
    expect(changes).toEqual([])
    await act(() => hdd!.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' })))
    expect(changes).toEqual(['hdd'])
  })

  it('supports controlled value', async (t) => {
    let changes: string[] = []

    function Controlled(handle: Handle) {
      let value: string | null = 'ssd'
      return () => (
        <div>
          <radioGroup.Context
            value={value}
            onValueChange={(next) => {
              changes.push(next)
              value = next
              void handle.update()
            }}
          >
            <div aria-label="Storage" mix={radioGroup.root()}>
              {storage.map((v) => (
                <Radio value={v} />
              ))}
            </div>
          </radioGroup.Context>
          <button
            id="clear"
            mix={on('click', () => {
              value = null
              void handle.update()
            })}
          >
            Clear
          </button>
        </div>
      )
    }

    let { $, act, container, cleanup } = render(<Controlled />)
    t.after(cleanup)

    let [, , nvme] = radios(container)
    await act(() => nvme!.click())
    expect(changes).toEqual(['nvme'])
    expect(summary(container)).toEqual(['ssd:false:-1', 'hdd:false:-1', 'nvme:true:0'])

    await act(() => ($('#clear') as HTMLElement).click())
    expect(summary(container)).toEqual(['ssd:false:0', 'hdd:false:-1', 'nvme:false:-1'])
    let inputs = [...container.querySelectorAll('input[type="radio"]')] as HTMLInputElement[]
    expect(inputs.map((input) => input.checked)).toEqual([false, false, false])
  })

  it('stays put when controlled and the owner ignores the change', async (t) => {
    let changes: string[] = []
    let { act, container, cleanup } = render(
      <form>
        <radioGroup.Context
          name="storage"
          value="ssd"
          onValueChange={(value) => void changes.push(value)}
        >
          <div aria-label="Storage" mix={radioGroup.root()}>
            {storage.map((value) => (
              <Radio value={value} />
            ))}
          </div>
        </radioGroup.Context>
      </form>,
    )
    t.after(cleanup)

    let [, hdd] = radios(container)
    await act(() => hdd!.click())
    await act(() => Promise.resolve())

    expect(changes).toEqual(['hdd'])
    expect(summary(container)).toEqual(['ssd:true:0', 'hdd:false:-1', 'nvme:false:-1'])
    let inputs = [...container.querySelectorAll('input[type="radio"]')] as HTMLInputElement[]
    expect(inputs.map((input) => input.checked)).toEqual([true, false, false])
  })

  it('participates in forms with name, form, and required', async (t) => {
    let { $, act, container, cleanup } = render(
      <div>
        <form id="settings" />
        <radioGroup.Context name="storage" form="settings" required>
          <div aria-label="Storage" mix={radioGroup.root()}>
            {storage.map((value) => (
              <Radio value={value} />
            ))}
          </div>
        </radioGroup.Context>
      </div>,
    )
    t.after(cleanup)

    let form = $('#settings') as HTMLFormElement
    let group = $('[role="radiogroup"]') as HTMLElement
    expect(group.getAttribute('aria-required')).toBe('true')
    expect(radios(container)[0]!.getAttribute('data-required')).toBe('')
    expect(form.checkValidity()).toBe(false)
    expect([...new FormData(form).entries()]).toEqual([])

    await act(() => radios(container)[1]!.click())
    expect(form.checkValidity()).toBe(true)
    expect([...new FormData(form).entries()]).toEqual([['storage', 'hdd']])
  })

  it('fires native change events on the hidden radio for form listeners', async (t) => {
    let nativeChanges: string[] = []
    let { act, container, cleanup } = render(
      <form
        mix={on('change', (event) => {
          nativeChanges.push((event.target as HTMLInputElement).value)
        })}
      >
        <radioGroup.Context name="storage">
          <div aria-label="Storage" mix={radioGroup.root()}>
            {storage.map((value) => (
              <Radio value={value} />
            ))}
          </div>
        </radioGroup.Context>
      </form>,
    )
    t.after(cleanup)

    await act(() => radios(container)[2]!.click())
    expect(nativeChanges).toEqual(['nvme'])
  })

  it('ignores interaction when the group or a radio is disabled', async (t) => {
    let changes: string[] = []
    let { $, act, container, cleanup } = render(
      <radioGroup.Context disabled onValueChange={(value) => void changes.push(value)}>
        <div aria-label="Storage" mix={radioGroup.root()}>
          <Radio value="ssd" />
          <Radio value="hdd" host="button" />
        </div>
      </radioGroup.Context>,
    )
    t.after(cleanup)

    let group = $('[role="radiogroup"]') as HTMLElement
    let [ssd, hdd] = radios(container)
    expect(group.getAttribute('data-disabled')).toBe('')
    expect(group.getAttribute('aria-disabled')).toBe('true')
    expect(ssd!.getAttribute('aria-disabled')).toBe('true')
    expect(ssd!.hasAttribute('tabindex')).toBe(false)
    expect(ssd!.getAttribute('data-disabled')).toBe('')
    expect((hdd as HTMLButtonElement).disabled).toBe(true)
    expect((container.querySelector('input') as HTMLInputElement).disabled).toBe(true)

    await act(() => ssd!.click())
    expect(changes).toEqual([])
    expect(ssd!.getAttribute('aria-checked')).toBe('false')
  })

  it('moves focus without selecting when read-only', async (t) => {
    let changes: string[] = []
    let { $, act, container, cleanup } = render(
      <radioGroup.Context readOnly defaultValue="ssd" onValueChange={(v) => void changes.push(v)}>
        <div aria-label="Storage" mix={radioGroup.root()}>
          {storage.map((value) => (
            <Radio value={value} />
          ))}
        </div>
      </radioGroup.Context>,
    )
    t.after(cleanup)

    let group = $('[role="radiogroup"]') as HTMLElement
    let [ssd, hdd] = radios(container)
    expect(group.getAttribute('aria-readonly')).toBe('true')
    expect(ssd!.getAttribute('data-readonly')).toBe('')

    ssd!.focus()
    await act(() => key(ssd!, 'ArrowDown'))
    expect(document.activeElement).toBe(hdd)
    await act(() => hdd!.click())
    let hiddenHdd = container.querySelectorAll('input[type="radio"]')[1] as HTMLInputElement
    await act(() => hiddenHdd.click())

    expect(changes).toEqual([])
    expect(ssd!.getAttribute('aria-checked')).toBe('true')
    expect(hiddenHdd.checked).toBe(false)
  })

  it('sets aria-orientation when an orientation is given', (t) => {
    let { $, cleanup } = render(
      <radioGroup.Context orientation="horizontal">
        <div aria-label="Storage" mix={radioGroup.root()}>
          <Radio value="ssd" />
        </div>
      </radioGroup.Context>,
    )
    t.after(cleanup)

    expect(($('[role="radiogroup"]') as HTMLElement).getAttribute('aria-orientation')).toBe(
      'horizontal',
    )
  })

  it('names span roots from their wrapping label and selects once on label click', async (t) => {
    let changes: string[] = []
    let { act, container, cleanup } = render(
      <radioGroup.Context onValueChange={(value) => void changes.push(value)}>
        <div aria-label="Storage" mix={radioGroup.root()}>
          {storage.map((value) => (
            <Radio value={value} />
          ))}
        </div>
      </radioGroup.Context>,
    )
    t.after(cleanup)
    await act(() => Promise.resolve())

    let [ssd] = radios(container)
    let label = container.querySelector('label') as HTMLLabelElement
    expect(label.id).not.toBe('')
    expect(ssd!.getAttribute('aria-labelledby')).toBe(label.id)

    await act(() => label.click())
    expect(changes).toEqual(['ssd'])
  })

  it('supports sibling labels through the hidden input id and a button root', async (t) => {
    let changes: string[] = []
    let { $, act, cleanup } = render(
      <radioGroup.Context onValueChange={(value) => void changes.push(value)}>
        <div aria-label="Storage" mix={radioGroup.root()}>
          <label for="ssd-input">SSD</label>
          <radio.Context value="ssd" id="ssd-input">
            <span mix={radio.root()} />
          </radio.Context>
          <label for="hdd-button">HDD</label>
          <radio.Context value="hdd">
            <button id="hdd-button" mix={radio.root()} />
          </radio.Context>
        </div>
      </radioGroup.Context>,
    )
    t.after(cleanup)

    await act(() => ($('label[for="ssd-input"]') as HTMLElement).click())
    expect(changes).toEqual(['ssd'])
    await act(() => ($('label[for="hdd-button"]') as HTMLElement).click())
    expect(changes).toEqual(['ssd', 'hdd'])
    expect(($('#hdd-button') as HTMLElement).getAttribute('type')).toBe('button')
  })

  it('redirects focus from the hidden input to the root', (t) => {
    let { container, cleanup } = render(
      <radioGroup.Context>
        <div aria-label="Storage" mix={radioGroup.root()}>
          <Radio value="ssd" />
        </div>
      </radioGroup.Context>,
    )
    t.after(cleanup)

    ;(container.querySelector('input[type="radio"]') as HTMLInputElement).focus()
    expect(document.activeElement).toBe(radios(container)[0])
  })

  it('keeps an unselected indicator visible with keepMounted', (t) => {
    let { $, cleanup } = render(
      <radioGroup.Context>
        <radio.Context value="ssd">
          <span aria-label="SSD" mix={radio.root()}>
            <span id="indicator" mix={radio.indicator({ keepMounted: true })} />
          </span>
        </radio.Context>
      </radioGroup.Context>,
    )
    t.after(cleanup)

    let indicator = $('#indicator') as HTMLElement
    expect(indicator.hidden).toBe(false)
    expect(indicator.getAttribute('data-unchecked')).toBe('')
  })

  it('exposes radio state through the Context value', (t) => {
    let seen: radio.RadioContextValue[] = []
    function Probe(handle: Handle) {
      return () => {
        seen.push({ ...handle.context.get(radio.Context) })
        return null
      }
    }

    let { cleanup } = render(
      <radioGroup.Context defaultValue="ssd" required>
        <radio.Context value="ssd" readOnly>
          <span aria-label="SSD" mix={radio.root()} />
          <Probe />
        </radio.Context>
      </radioGroup.Context>,
    )
    t.after(cleanup)

    let last = seen[seen.length - 1]!
    expect(last.value).toBe('ssd')
    expect(last.checked).toBe(true)
    expect(last.readOnly).toBe(true)
    expect(last.required).toBe(true)
    expect(last.disabled).toBe(false)
  })

  it('lets explicit host props win', (t) => {
    let { $, cleanup } = render(
      <radioGroup.Context>
        <radio.Context value="ssd">
          <span aria-label="SSD" tabIndex={-1} mix={radio.root()} />
        </radio.Context>
      </radioGroup.Context>,
    )
    t.after(cleanup)

    expect(($('[role="radio"]') as HTMLElement).tabIndex).toBe(-1)
  })

  it('reports helpful errors outside the providers', (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    let errors: unknown[] = []
    root.addEventListener('error', (event) => void errors.push((event as ErrorEvent).error))
    t.after(() => {
      root.dispose()
      container.remove()
    })

    root.render(
      <div>
        <div mix={radioGroup.root()} />
        <span mix={radio.root()} />
        <radio.Context value="x" />
      </div>,
    )
    root.flush()

    let messages = errors.map(String).join('\n')
    expect(messages).toMatch(/radioGroup\.root\(\) must be rendered inside/)
  })
})

function submit(formNode: Element) {
  formNode.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
}

function FieldRadio(handle: Handle<{ value: string; disabled?: boolean }>) {
  return () => (
    <field.ItemContext disabled={handle.props.disabled}>
      <div data-item={handle.props.value} mix={field.item()}>
        <label mix={field.label()}>
          <radio.Context value={handle.props.value}>
            <span data-value={handle.props.value} mix={radio.root()}>
              <span mix={radio.indicator({ keepMounted: true })} />
            </span>
          </radio.Context>
          {handle.props.value}
        </label>
        <p mix={field.description()}>About {handle.props.value}</p>
      </div>
    </field.ItemContext>
  )
}

describe('radio group in a field', () => {
  it('is the field control; field.ItemContext labels each radio', async (t) => {
    let { $, $$, act, container, cleanup } = render(
      <field.Context name="storage">
        <div id="group-label" mix={field.label()}>
          Storage
        </div>
        <radioGroup.Context name="ignored">
          <div mix={radioGroup.root()}>
            <FieldRadio value="ssd" />
            <FieldRadio value="hdd" />
          </div>
        </radioGroup.Context>
        <p id="group-description" mix={field.description()}>
          Pick one
        </p>
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let group = $('[role="radiogroup"]') as HTMLElement
    expect(group.getAttribute('aria-labelledby')).toBe('group-label')
    expect(group.getAttribute('aria-describedby')).toBe('group-description')

    let roots = radios(container)
    let inputs = [...$$('input')] as HTMLInputElement[]
    let labels = [...$$('label')] as HTMLLabelElement[]
    let descriptions = [...$$('[data-item] p')] as HTMLElement[]
    roots.forEach((root, index) => {
      expect(labels[index]!.htmlFor).toBe(inputs[index]!.id)
      expect(root.getAttribute('aria-labelledby')).toBe(labels[index]!.id)
      expect(root.getAttribute('aria-describedby')).toBe(descriptions[index]!.id)
      // `role="radio"` doesn't support aria-invalid; the radiogroup carries it.
      expect(root.hasAttribute('aria-invalid')).toBe(false)
    })
    expect(inputs.map((input) => input.name)).toEqual(['storage', 'storage'])

    await act(() => roots[1]!.click())
    expect(roots[1]!.getAttribute('aria-checked')).toBe('true')
    expect(group.hasAttribute('data-filled')).toBe(true)
    expect(roots[0]!.hasAttribute('data-dirty')).toBe(true)
    expect(($('[data-item="hdd"]') as HTMLElement).hasAttribute('data-filled')).toBe(true)
  })

  it('blocks a required group, focuses the first radio and validates the value', async (t) => {
    let submitted: form.FormValues[] = []
    let { $, act, container, cleanup } = render(
      <form.Context onFormSubmit={(values) => void submitted.push(values)}>
        <form mix={form.root()}>
          <field.Context name="storage" validate={(value) => (value === 'hdd' ? 'Too slow' : null)}>
            <radioGroup.Context required>
              <div aria-label="Storage" mix={radioGroup.root()}>
                <FieldRadio value="ssd" />
                <FieldRadio value="hdd" />
              </div>
            </radioGroup.Context>
            <div id="error" mix={field.error()}>
              <field.Validity>
                {(state) => (state.validity.valueMissing ? 'Required' : state.error)}
              </field.Validity>
            </div>
          </field.Context>
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    let group = $('[role="radiogroup"]') as HTMLElement
    let roots = radios(container)
    await act(() => submit($('form')!))
    expect(submitted).toEqual([])
    expect(document.activeElement).toBe(roots[0])
    expect(group.getAttribute('aria-invalid')).toBe('true')
    expect(group.getAttribute('aria-describedby')).toBe('error')
    expect(roots[0]!.hasAttribute('data-invalid')).toBe(true)
    expect($('#error')!.textContent).toBe('Required')

    await act(() => roots[1]!.click())
    expect($('#error')!.textContent).toBe('Too slow')
    await act(() => roots[0]!.click())
    expect(group.hasAttribute('data-valid')).toBe(true)
    await act(() => submit($('form')!))
    expect(submitted).toEqual([{ storage: 'ssd' }])
  })

  it('clears server errors on change', async (t) => {
    let { $, act, container, cleanup } = render(
      <form.Context errors={{ storage: 'Out of stock' }}>
        <field.Context name="storage">
          <radioGroup.Context>
            <div aria-label="Storage" mix={radioGroup.root()}>
              <FieldRadio value="ssd" />
            </div>
          </radioGroup.Context>
        </field.Context>
      </form.Context>,
    )
    t.after(cleanup)
    let group = $('[role="radiogroup"]') as HTMLElement
    expect(group.getAttribute('aria-invalid')).toBe('true')
    await act(() => radios(container)[0]!.click())
    expect(group.hasAttribute('aria-invalid')).toBe(false)
  })

  it('tracks focus for the whole group', async (t) => {
    let { $, act, container, cleanup } = render(
      <div>
        <field.Context>
          <radioGroup.Context defaultValue="ssd">
            <div aria-label="Storage" mix={radioGroup.root()}>
              <FieldRadio value="ssd" />
              <FieldRadio value="hdd" />
            </div>
          </radioGroup.Context>
        </field.Context>
        <button>Other</button>
      </div>,
    )
    t.after(cleanup)
    let group = $('[role="radiogroup"]') as HTMLElement
    let roots = radios(container)
    await act(() => roots[0]!.focus())
    expect(group.hasAttribute('data-focused')).toBe(true)
    await act(() => key(roots[0]!, 'ArrowDown'))
    expect(document.activeElement).toBe(roots[1])
    expect(group.hasAttribute('data-touched')).toBe(false)
    expect(group.hasAttribute('data-dirty')).toBe(true)
    await act(() => ($('button') as HTMLElement).focus())
    expect(group.hasAttribute('data-touched')).toBe(true)
    expect(group.hasAttribute('data-focused')).toBe(false)
  })

  it('is disabled by the field, a fieldset or a field item', (t) => {
    let { $$, container, cleanup } = render(
      <div>
        <fieldset.Context disabled>
          <radioGroup.Context>
            <div aria-label="A" mix={radioGroup.root()}>
              <Radio value="a" />
            </div>
          </radioGroup.Context>
        </fieldset.Context>
        <field.Context disabled>
          <radioGroup.Context>
            <div aria-label="B" mix={radioGroup.root()}>
              <FieldRadio value="b" />
            </div>
          </radioGroup.Context>
        </field.Context>
        <field.Context>
          <radioGroup.Context>
            <div aria-label="C" mix={radioGroup.root()}>
              <FieldRadio value="c" disabled />
              <FieldRadio value="d" />
            </div>
          </radioGroup.Context>
        </field.Context>
      </div>,
    )
    t.after(cleanup)
    let groups = [...$$('[role="radiogroup"]')] as HTMLElement[]
    expect(groups.map((group) => group.hasAttribute('data-disabled'))).toEqual([true, true, false])
    expect(radios(container).map((root) => root.getAttribute('aria-disabled'))).toEqual([
      'true',
      'true',
      'true',
      null,
    ])
    // The first enabled radio is the tab stop.
    expect(radios(container)[3]!.tabIndex).toBe(0)
  })
})

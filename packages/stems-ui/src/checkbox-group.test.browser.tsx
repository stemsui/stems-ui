import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { createRoot, on, type Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as checkbox from './checkbox.ts'
import * as checkboxGroup from './checkbox-group.ts'
import * as field from './field.ts'
import * as fieldset from './fieldset.ts'
import * as form from './form.ts'

const fruits = ['fuji', 'gala', 'granny']

function Item(handle: Handle<{ value: string; disabled?: boolean; name?: string }>) {
  return () => (
    <label>
      <checkbox.Context
        name={handle.props.name ?? 'apple'}
        value={handle.props.value}
        disabled={handle.props.disabled}
      >
        <span data-value={handle.props.value} mix={checkbox.root()}>
          <span mix={checkbox.indicator()} />
        </span>
      </checkbox.Context>
      {handle.props.value}
    </label>
  )
}

function states(container: Element) {
  return [...container.querySelectorAll('[role="checkbox"][data-value]')].map(
    (node) => `${node.getAttribute('data-value')}:${node.getAttribute('aria-checked')}`,
  )
}

describe('checkbox-group', () => {
  it('renders a group and checks members from defaultValue (uncontrolled)', async (t) => {
    let changes: string[][] = []
    let events: checkboxGroup.CheckboxGroupChangeEvent[] = []
    let { $, act, container, cleanup } = render(
      <checkboxGroup.Context
        defaultValue={['fuji']}
        onValueChange={(value) => void changes.push(value)}
      >
        <div
          aria-label="Apples"
          mix={[
            checkboxGroup.root(),
            checkboxGroup.onCheckboxGroupChange((event) => void events.push(event)),
          ]}
        >
          {fruits.map((value) => (
            <Item value={value} />
          ))}
        </div>
      </checkboxGroup.Context>,
    )
    t.after(cleanup)

    let group = $('[role="group"]') as HTMLElement
    expect(group.hasAttribute('data-disabled')).toBe(false)
    expect(states(container)).toEqual(['fuji:true', 'gala:false', 'granny:false'])

    await act(() => ($('[data-value="gala"]') as HTMLElement).click())
    expect(states(container)).toEqual(['fuji:true', 'gala:true', 'granny:false'])
    expect(changes).toEqual([['fuji', 'gala']])
    expect(events.length).toBe(1)
    expect(events[0]).toBeInstanceOf(checkboxGroup.CheckboxGroupChangeEvent)
    expect(events[0]?.value).toEqual(['fuji', 'gala'])
    expect(events[0]?.target).toBe($('[data-value="gala"]'))

    await act(() => ($('[data-value="fuji"]') as HTMLElement).click())
    expect(states(container)).toEqual(['fuji:false', 'gala:true', 'granny:false'])
    expect(changes).toEqual([['fuji', 'gala'], ['gala']])
  })

  it('submits each ticked checkbox with its name and value', async (t) => {
    let { $, act, cleanup } = render(
      <form>
        <checkboxGroup.Context defaultValue={['gala']}>
          <div aria-label="Apples" mix={checkboxGroup.root()}>
            {fruits.map((value) => (
              <Item value={value} />
            ))}
          </div>
        </checkboxGroup.Context>
      </form>,
    )
    t.after(cleanup)

    let form = $('form') as HTMLFormElement
    expect([...new FormData(form).entries()]).toEqual([['apple', 'gala']])
    await act(() => ($('[data-value="granny"]') as HTMLElement).click())
    expect([...new FormData(form).entries()]).toEqual([
      ['apple', 'gala'],
      ['apple', 'granny'],
    ])
  })

  it('identifies a member by name when it has no value', async (t) => {
    let changes: string[][] = []
    let { $, act, cleanup } = render(
      <checkboxGroup.Context onValueChange={(value) => void changes.push(value)}>
        <div aria-label="Options" mix={checkboxGroup.root()}>
          <checkbox.Context name="wifi">
            <span aria-label="Wi-Fi" mix={checkbox.root()} />
          </checkbox.Context>
        </div>
      </checkboxGroup.Context>,
    )
    t.after(cleanup)

    await act(() => ($('[role="checkbox"]') as HTMLElement).click())
    expect(changes).toEqual([['wifi']])
    expect(($('[role="checkbox"]') as HTMLElement).getAttribute('aria-checked')).toBe('true')
  })

  it('supports controlled value and ignores member checked props', async (t) => {
    let changes: string[][] = []

    function Controlled(handle: Handle) {
      let value: string[] = ['granny']
      return () => (
        <div>
          <checkboxGroup.Context
            value={value}
            onValueChange={(next) => {
              changes.push(next)
              value = next
              void handle.update()
            }}
          >
            <div aria-label="Apples" mix={checkboxGroup.root()}>
              {fruits.map((v) => (
                <Item value={v} />
              ))}
            </div>
          </checkboxGroup.Context>
          <button
            id="all"
            mix={on('click', () => {
              value = [...fruits]
              void handle.update()
            })}
          >
            All
          </button>
        </div>
      )
    }

    let { $, act, container, cleanup } = render(<Controlled />)
    t.after(cleanup)

    expect(states(container)).toEqual(['fuji:false', 'gala:false', 'granny:true'])
    await act(() => ($('[data-value="fuji"]') as HTMLElement).click())
    expect(states(container)).toEqual(['fuji:true', 'gala:false', 'granny:true'])
    expect(changes).toEqual([['granny', 'fuji']])

    await act(() => ($('#all') as HTMLElement).click())
    expect(states(container)).toEqual(['fuji:true', 'gala:true', 'granny:true'])
    let inputs = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]
    expect(inputs.map((input) => input.checked)).toEqual([true, true, true])
  })

  it('stays put when controlled and the owner ignores the change', async (t) => {
    let changes: string[][] = []
    let { $, act, container, cleanup } = render(
      <checkboxGroup.Context value={['fuji']} onValueChange={(v) => void changes.push(v)}>
        <div aria-label="Apples" mix={checkboxGroup.root()}>
          {fruits.map((value) => (
            <Item value={value} />
          ))}
        </div>
      </checkboxGroup.Context>,
    )
    t.after(cleanup)

    await act(() => ($('[data-value="gala"]') as HTMLElement).click())
    await act(() => Promise.resolve())
    expect(changes).toEqual([['fuji', 'gala']])
    expect(states(container)).toEqual(['fuji:true', 'gala:false', 'granny:false'])
    let inputs = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]
    expect(inputs.map((input) => input.checked)).toEqual([true, false, false])
  })

  it('disables every member when the group is disabled', async (t) => {
    let changes: string[][] = []
    let { $, act, container, cleanup } = render(
      <checkboxGroup.Context disabled onValueChange={(v) => void changes.push(v)}>
        <div aria-label="Apples" mix={checkboxGroup.root()}>
          {fruits.map((value) => (
            <Item value={value} />
          ))}
        </div>
      </checkboxGroup.Context>,
    )
    t.after(cleanup)

    expect(($('[role="group"]') as HTMLElement).getAttribute('data-disabled')).toBe('')
    let gala = $('[data-value="gala"]') as HTMLElement
    expect(gala.getAttribute('aria-disabled')).toBe('true')
    expect(gala.getAttribute('data-disabled')).toBe('')
    expect((container.querySelector('input') as HTMLInputElement).disabled).toBe(true)

    await act(() => gala.click())
    expect(changes).toEqual([])
  })

  it('drives a parent checkbox: all, none, and mixed with a restored selection', async (t) => {
    let changes: string[][] = []
    let { $, act, container, cleanup } = render(
      <checkboxGroup.Context
        defaultValue={[]}
        allValues={fruits}
        onValueChange={(value) => void changes.push(value)}
      >
        <div aria-labelledby="apples" mix={checkboxGroup.root()}>
          <label id="apples">
            <checkbox.Context parent>
              <span id="parent" mix={checkbox.root()}>
                <span mix={checkbox.indicator()} />
              </span>
            </checkbox.Context>
            Apples
          </label>
          {fruits.map((value) => (
            <Item value={value} />
          ))}
        </div>
      </checkboxGroup.Context>,
    )
    t.after(cleanup)

    let parent = $('#parent') as HTMLElement
    let parentState = () => parent.getAttribute('aria-checked')

    expect(parentState()).toBe('false')
    let childIds = fruits.map((value) =>
      ($(`[data-value="${value}"]`) as HTMLElement).getAttribute('id'),
    )
    expect(childIds.every((id) => id !== null && id !== '')).toBe(true)
    expect(parent.getAttribute('aria-controls')).toBe(childIds.join(' '))

    // Everything off → parent ticks all.
    await act(() => parent.click())
    expect(parentState()).toBe('true')
    expect(parent.hasAttribute('data-checked')).toBe(true)
    expect(states(container)).toEqual(['fuji:true', 'gala:true', 'granny:true'])

    // And unticks all.
    await act(() => parent.click())
    expect(parentState()).toBe('false')
    expect(states(container)).toEqual(['fuji:false', 'gala:false', 'granny:false'])

    // A partial selection makes the parent mixed.
    await act(() => ($('[data-value="gala"]') as HTMLElement).click())
    expect(parentState()).toBe('mixed')
    expect(parent.getAttribute('data-indeterminate')).toBe('')
    expect(parent.hasAttribute('data-checked')).toBe(false)
    expect(parent.hasAttribute('data-unchecked')).toBe(false)

    // mixed → all → none → the user's selection.
    await act(() => parent.click())
    expect(states(container)).toEqual(['fuji:true', 'gala:true', 'granny:true'])
    await act(() => parent.click())
    expect(states(container)).toEqual(['fuji:false', 'gala:false', 'granny:false'])
    await act(() => parent.click())
    expect(states(container)).toEqual(['fuji:false', 'gala:true', 'granny:false'])
    expect(parentState()).toBe('mixed')

    expect(changes).toEqual([
      ['fuji', 'gala', 'granny'],
      [],
      ['gala'],
      ['fuji', 'gala', 'granny'],
      [],
      ['gala'],
    ])
  })

  it('keeps disabled children unchanged when the parent toggles', async (t) => {
    let { $, act, container, cleanup } = render(
      <checkboxGroup.Context defaultValue={['granny']} allValues={fruits}>
        <div aria-label="Apples" mix={checkboxGroup.root()}>
          <checkbox.Context parent>
            <span id="parent" aria-label="All apples" mix={checkbox.root()} />
          </checkbox.Context>
          <Item value="fuji" />
          <Item value="gala" disabled />
          <Item value="granny" disabled />
        </div>
      </checkboxGroup.Context>,
    )
    t.after(cleanup)

    let parent = $('#parent') as HTMLElement
    await act(() => parent.click())
    expect(states(container)).toEqual(['fuji:true', 'gala:false', 'granny:true'])
    await act(() => parent.click())
    expect(states(container)).toEqual(['fuji:false', 'gala:false', 'granny:true'])
  })

  it('uses explicit child ids in the parent aria-controls', async (t) => {
    let { $, act, cleanup } = render(
      <checkboxGroup.Context allValues={['a', 'b']}>
        <div aria-label="Letters" mix={checkboxGroup.root()}>
          <checkbox.Context parent>
            <span id="parent" aria-label="All" mix={checkbox.root()} />
          </checkbox.Context>
          <checkbox.Context value="a">
            <button id="letter-a" aria-label="A" mix={checkbox.root()} />
          </checkbox.Context>
          <checkbox.Context value="b">
            <span aria-label="B" mix={checkbox.root()} />
          </checkbox.Context>
        </div>
      </checkboxGroup.Context>,
    )
    t.after(cleanup)
    await act(() => Promise.resolve())

    let parent = $('#parent') as HTMLElement
    let [, , b] = [...document.querySelectorAll('[role="checkbox"]')] as HTMLElement[]
    expect(parent.getAttribute('aria-controls')).toBe(`letter-a ${b!.id}`)
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

    root.render(<div mix={checkboxGroup.root()} />)
    root.flush()

    expect(String(errors[0])).toMatch(/checkboxGroup\.root\(\) must be rendered inside/)
  })
})

function submit(formNode: Element) {
  formNode.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
}

function FieldItem(handle: Handle<{ value: string; disabled?: boolean; required?: boolean }>) {
  return () => (
    <field.ItemContext disabled={handle.props.disabled}>
      <div data-item={handle.props.value} mix={field.item()}>
        <checkbox.Context value={handle.props.value} required={handle.props.required}>
          <span data-value={handle.props.value} mix={checkbox.root()} />
        </checkbox.Context>
        <label mix={field.label()}>{handle.props.value}</label>
        <p mix={field.description()}>About {handle.props.value}</p>
      </div>
    </field.ItemContext>
  )
}

describe('checkbox group in a field', () => {
  it('is the field control; field.ItemContext labels each checkbox', async (t) => {
    let { $, $$, act, container, cleanup } = render(
      <field.Context name="protocols">
        <div id="group-label" mix={field.label()}>
          Protocols
        </div>
        <checkboxGroup.Context defaultValue={['http']}>
          <div mix={checkboxGroup.root()}>
            <FieldItem value="http" />
            <FieldItem value="ssh" />
          </div>
        </checkboxGroup.Context>
        <p id="group-description" mix={field.description()}>
          Pick any
        </p>
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let group = $('[role="group"]') as HTMLElement
    expect(group.getAttribute('aria-labelledby')).toBe('group-label')
    expect(group.getAttribute('aria-describedby')).toBe('group-description')
    expect(group.hasAttribute('data-filled')).toBe(true)

    let roots = [...$$('[role="checkbox"]')] as HTMLElement[]
    let inputs = [...$$('input')] as HTMLInputElement[]
    let labels = [...$$('label')] as HTMLLabelElement[]
    let descriptions = [...$$('[data-item] p')] as HTMLElement[]
    roots.forEach((root, index) => {
      expect(labels[index]!.htmlFor).toBe(inputs[index]!.id)
      expect(root.getAttribute('aria-labelledby')).toBe(labels[index]!.id)
      expect(root.getAttribute('aria-describedby')).toBe(descriptions[index]!.id)
    })
    expect(new Set(inputs.map((input) => input.id)).size).toBe(2)
    expect(inputs.map((input) => input.name)).toEqual(['protocols', 'protocols'])

    // Clicking an item label toggles its checkbox; the group value is the field value.
    await act(() => labels[1]!.click())
    expect(states(container)).toEqual(['http:true', 'ssh:true'])
    expect(group.hasAttribute('data-dirty')).toBe(true)
    expect(roots[1]!.hasAttribute('data-dirty')).toBe(true)
    expect(($('[data-item="ssh"]') as HTMLElement).hasAttribute('data-dirty')).toBe(true)
  })

  it('validates the array value, blocks submission and focuses the first checkbox', async (t) => {
    let submitted: form.FormValues[] = []
    let { $, $$, act, cleanup } = render(
      <form.Context onFormSubmit={(values) => void submitted.push(values)}>
        <form mix={form.root()}>
          <field.Context
            name="protocols"
            validate={(value) => ((value as string[]).length < 2 ? 'Pick two' : null)}
          >
            <checkboxGroup.Context>
              <div aria-label="Protocols" mix={checkboxGroup.root()}>
                <FieldItem value="http" />
                <FieldItem value="ssh" />
              </div>
            </checkboxGroup.Context>
            <div id="error" mix={field.error()}>
              <field.Validity>{(state) => state.error}</field.Validity>
            </div>
          </field.Context>
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    let roots = [...$$('[role="checkbox"]')] as HTMLElement[]
    await act(() => submit($('form')!))
    expect(submitted).toEqual([])
    expect(document.activeElement).toBe(roots[0])
    expect($('#error')!.textContent).toBe('Pick two')
    expect(roots[0]!.getAttribute('aria-invalid')).toBe('true')
    expect(roots[0]!.hasAttribute('data-invalid')).toBe(true)
    expect($('[role="group"]')!.hasAttribute('data-invalid')).toBe(true)
    expect($('[role="group"]')!.getAttribute('aria-describedby')).toBe('error')

    await act(() => roots[0]!.click())
    await act(() => roots[1]!.click())
    expect(roots[0]!.hasAttribute('data-valid')).toBe(true)
    await act(() => submit($('form')!))
    expect(submitted).toEqual([{ protocols: ['http', 'ssh'] }])
  })

  it('blocks a required checkbox and focuses it', async (t) => {
    let submitted = 0
    let { $, $$, act, cleanup } = render(
      <form.Context onFormSubmit={() => void submitted++}>
        <form mix={form.root()}>
          <field.Context name="consent">
            <checkboxGroup.Context>
              <div aria-label="Consent" mix={checkboxGroup.root()}>
                <FieldItem value="news" />
                <FieldItem value="terms" required />
              </div>
            </checkboxGroup.Context>
            <div id="error" mix={field.error({ match: 'valueMissing' })}>
              Accept the terms
            </div>
          </field.Context>
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    let roots = [...$$('[role="checkbox"]')] as HTMLElement[]
    await act(() => submit($('form')!))
    expect(submitted).toBe(0)
    expect(document.activeElement).toBe(roots[1])
    expect(($('#error') as HTMLElement).hidden).toBe(false)
    await act(() => roots[1]!.click())
    expect(roots[1]!.hasAttribute('data-valid')).toBe(true)
    expect($('[role="group"]')!.hasAttribute('aria-describedby')).toBe(false)
    await act(() => submit($('form')!))
    expect(submitted).toBe(1)
  })

  it('clears server errors on change', async (t) => {
    let { $, $$, act, cleanup } = render(
      <form.Context errors={{ protocols: 'Not available' }}>
        <field.Context name="protocols">
          <checkboxGroup.Context>
            <div aria-label="Protocols" mix={checkboxGroup.root()}>
              <FieldItem value="http" />
            </div>
          </checkboxGroup.Context>
        </field.Context>
      </form.Context>,
    )
    t.after(cleanup)
    let root = $$('[role="checkbox"]')[0] as HTMLElement
    expect(root.getAttribute('aria-invalid')).toBe('true')
    expect($('[role="group"]')!.hasAttribute('data-invalid')).toBe(true)
    await act(() => root.click())
    expect(root.hasAttribute('aria-invalid')).toBe(false)
  })

  it('tracks focus for the whole group', async (t) => {
    let { $, $$, act, cleanup } = render(
      <div>
        <field.Context>
          <checkboxGroup.Context>
            <div aria-label="Protocols" mix={checkboxGroup.root()}>
              <FieldItem value="http" />
              <FieldItem value="ssh" />
            </div>
          </checkboxGroup.Context>
        </field.Context>
        <button>Other</button>
      </div>,
    )
    t.after(cleanup)
    let roots = [...$$('[role="checkbox"]')] as HTMLElement[]
    let group = $('[role="group"]') as HTMLElement
    await act(() => roots[0]!.focus())
    expect(group.hasAttribute('data-focused')).toBe(true)
    await act(() => roots[1]!.focus())
    expect(group.hasAttribute('data-touched')).toBe(false)
    await act(() => ($('button') as HTMLElement).focus())
    expect(group.hasAttribute('data-focused')).toBe(false)
    expect(group.hasAttribute('data-touched')).toBe(true)
  })

  it('is disabled by the field, a fieldset or a field item', (t) => {
    let { $$, cleanup } = render(
      <div>
        <fieldset.Context disabled>
          <checkboxGroup.Context>
            <div aria-label="A" mix={checkboxGroup.root()}>
              <Item value="fuji" />
            </div>
          </checkboxGroup.Context>
        </fieldset.Context>
        <field.Context disabled>
          <checkboxGroup.Context>
            <div aria-label="B" mix={checkboxGroup.root()}>
              <FieldItem value="gala" />
            </div>
          </checkboxGroup.Context>
        </field.Context>
        <field.Context>
          <checkboxGroup.Context>
            <div aria-label="C" mix={checkboxGroup.root()}>
              <FieldItem value="granny" disabled />
              <FieldItem value="pink" />
            </div>
          </checkboxGroup.Context>
        </field.Context>
      </div>,
    )
    t.after(cleanup)
    let groups = [...$$('[role="group"]')] as HTMLElement[]
    expect(groups.map((group) => group.hasAttribute('data-disabled'))).toEqual([true, true, false])
    let roots = [...$$('[role="checkbox"]')] as HTMLElement[]
    expect(roots.map((root) => root.getAttribute('aria-disabled'))).toEqual([
      'true',
      'true',
      'true',
      null,
    ])
    let items = [...$$('[data-item]')] as HTMLElement[]
    expect(items.map((item) => item.hasAttribute('data-disabled'))).toEqual([true, true, false])
  })
})

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { on, type Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as field from './field.ts'
import * as form from './form.ts'

function type(element: HTMLInputElement, value: string) {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

async function waitForHidden(element: Element) {
  for (let i = 0; i < 10 && !(element as HTMLElement).hidden; i++) await nextFrame()
  assert.equal((element as HTMLElement).hidden, true, `${element.id} hidden`)
}

/** Dispatches a cancelable submit event and reports whether it was prevented. */
function submit(formElement: HTMLFormElement) {
  return !formElement.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
}

function NameAndEmail(handle: Handle<{ email?: string }>) {
  return () => (
    <>
      <field.Context name="name">
        <input required mix={field.control()} />
        <div id="name-error" mix={field.error()}>
          <field.Validity>{(state) => state.error}</field.Validity>
        </div>
      </field.Context>
      <field.Context name="email">
        <input type="email" mix={field.control({ defaultValue: handle.props.email })} />
        <div id="email-error" mix={field.error()}>
          <field.Validity>{(state) => state.error}</field.Validity>
        </div>
      </field.Context>
    </>
  )
}

describe('form', () => {
  it('sets noValidate once hydrated, unless the host sets it', (t) => {
    let { $$, cleanup } = render(
      <div>
        <form.Context>
          <form id="a" mix={form.root()} />
        </form.Context>
        <form.Context>
          <form id="b" noValidate={false} mix={form.root()} />
        </form.Context>
      </div>,
    )
    t.after(cleanup)
    let [a, b] = $$('form') as unknown as HTMLFormElement[]
    assert.equal(a!.noValidate, true)
    assert.equal(b!.noValidate, false)
  })

  it('blocks invalid submissions and focuses the first invalid control', async (t) => {
    let submitted: unknown[] = []
    let later = 0
    let { $, $$, act, cleanup } = render(
      <form.Context onFormSubmit={(values) => submitted.push(values)}>
        <form
          mix={[
            form.root(),
            on('submit', () => {
              later++
            }),
          ]}
        >
          <NameAndEmail email="nope" />
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    let [name, email] = $$('input') as unknown as HTMLInputElement[]

    let prevented: boolean | undefined
    await act(() => {
      prevented = submit($('form') as HTMLFormElement)
    })
    assert.equal(prevented, true)
    assert.deepEqual(submitted, [])
    assert.equal(later, 0, 'later submit listeners only see valid submissions')
    assert.equal(document.activeElement, name)
    assert.equal(name!.getAttribute('aria-invalid'), 'true')
    assert.equal(email!.getAttribute('aria-invalid'), 'true')
    assert.equal(($('#email-error') as HTMLElement).hidden, false)

    // Fields re-validate on change after a submission attempt.
    await act(() => type(name!, 'Ada'))
    assert.equal(name!.hasAttribute('data-valid'), true)
    await act(() => {
      prevented = submit($('form') as HTMLFormElement)
    })
    assert.equal(document.activeElement, email)
  })

  it('calls onFormSubmit with the field values and prevents the native submission', async (t) => {
    let calls: Array<[form.FormValues, form.FormSubmitEventDetails]> = []
    let events: form.FormValues[] = []
    let { $, act, cleanup } = render(
      <form.Context onFormSubmit={(values, details) => calls.push([values, details])}>
        <form mix={[form.root(), form.onFormSubmit((event) => void events.push(event.values))]}>
          <NameAndEmail email="ada@example.com" />
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    await act(() => type($('input') as HTMLInputElement, 'Ada'))

    let prevented: boolean | undefined
    await act(() => {
      prevented = submit($('form') as HTMLFormElement)
    })
    assert.equal(prevented, true)
    assert.deepEqual(calls[0]![0], { name: 'Ada', email: 'ada@example.com' })
    assert.equal(calls[0]![1].reason, 'none')
    assert.equal(calls[0]![1].event.type, 'submit')
    assert.deepEqual(events, [{ name: 'Ada', email: 'ada@example.com' }])
  })

  it('lets valid submissions through without onFormSubmit', async (t) => {
    let { $, act, cleanup } = render(
      <form.Context>
        <form mix={form.root()}>
          <NameAndEmail />
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    await act(() => type($('input') as HTMLInputElement, 'Ada'))
    let prevented: boolean | undefined
    await act(() => {
      prevented = submit($('form') as HTMLFormElement)
    })
    assert.equal(prevented, false)
  })

  it('still validates controls that are not inside a field', async (t) => {
    let { $, act, cleanup } = render(
      <form.Context>
        <form mix={form.root()}>
          <input id="plain" required />
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    let prevented: boolean | undefined
    await act(() => {
      prevented = submit($('form') as HTMLFormElement)
    })
    assert.equal(prevented, true)
    assert.equal(document.activeElement, $('#plain'))
  })

  it('maps external errors onto fields and clears them when the value changes', async (t) => {
    let cleared: form.FormErrors[] = []
    let setErrors: (errors: form.FormErrors) => void = () => {}
    function App(handle: Handle) {
      let errors: form.FormErrors = {
        name: 'Name is taken',
        email: ['Email is blocked', 'Try another'],
      }
      setErrors = (next) => {
        errors = next
        void handle.update()
      }
      return () => (
        <form.Context errors={errors} onClearErrors={(next) => cleared.push(next)}>
          <form mix={form.root()}>
            <NameAndEmail email="ada@example.com" />
          </form>
        </form.Context>
      )
    }
    let { $, $$, act, cleanup } = render(<App />)
    t.after(cleanup)
    let [name, email] = $$('input') as unknown as HTMLInputElement[]

    assert.equal(name!.getAttribute('aria-invalid'), 'true')
    assert.equal(name!.hasAttribute('data-invalid'), true)
    assert.equal($('#name-error')!.textContent, 'Name is taken')
    assert.equal($('#email-error')!.textContent, 'Email is blocked')

    await act(() => type(name!, 'Grace'))
    assert.equal(name!.hasAttribute('aria-invalid'), false)
    await waitForHidden($('#name-error')!)
    assert.deepEqual(cleared, [{ email: ['Email is blocked', 'Try another'] }])
    assert.equal(email!.getAttribute('aria-invalid'), 'true', 'other fields keep their errors')

    // External errors don't block a new submission: the server decides again.
    let prevented: boolean | undefined
    await act(() => {
      prevented = submit($('form') as HTMLFormElement)
    })
    assert.equal(prevented, false)

    await act(() => setErrors({ name: 'Still taken' }))
    assert.equal($('#name-error')!.textContent, 'Still taken')
    assert.equal(email!.hasAttribute('aria-invalid'), false)
  })

  it('applies the form validationMode to its fields', async (t) => {
    let { $, act, cleanup } = render(
      <form.Context validationMode="onBlur">
        <form mix={form.root()}>
          <field.Context>
            <input required mix={field.control()} />
          </field.Context>
          <field.Context validationMode="onChange">
            <input id="eager" type="email" mix={field.control()} />
          </field.Context>
          <button type="button">Other</button>
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    let control = $('input') as HTMLInputElement
    await act(() => control.focus())
    await act(() => ($('button') as HTMLButtonElement).focus())
    assert.equal(control.hasAttribute('data-invalid'), true)

    await act(() => type($('#eager') as HTMLInputElement, 'x'))
    assert.equal($('#eager')!.hasAttribute('data-invalid'), true, 'the field mode wins')
  })

  it('validates all fields or one field through actionsRef', async (t) => {
    let actions: { current: form.FormActions | null } = { current: null }
    let { $$, act, cleanup } = render(
      <form.Context actionsRef={actions}>
        <form mix={form.root()}>
          <NameAndEmail email="nope" />
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    let [name, email] = $$('input') as unknown as HTMLInputElement[]

    await act(() => actions.current!.validate('email'))
    assert.equal(email!.hasAttribute('data-invalid'), true)
    assert.equal(name!.hasAttribute('data-invalid'), false)

    await act(() => actions.current!.validate())
    assert.equal(name!.hasAttribute('data-invalid'), true)
  })

  it('passes form values to field validate functions', async (t) => {
    let seen: unknown[] = []
    let { $$, act, cleanup } = render(
      <form.Context validationMode="onChange">
        <form mix={form.root()}>
          <field.Context name="password">
            <input mix={field.control()} />
          </field.Context>
          <field.Context
            name="confirm"
            validate={(value, values) => {
              seen.push(values)
              return value === values.password ? null : 'Passwords differ'
            }}
          >
            <input mix={field.control()} />
          </field.Context>
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    let [password, confirm] = $$('input') as unknown as HTMLInputElement[]
    await act(() => type(password!, 'secret'))
    await act(() => type(confirm!, 'secrex'))
    assert.equal(confirm!.validationMessage, 'Passwords differ')
    assert.deepEqual(seen.at(-1), { password: 'secret', confirm: 'secrex' })
  })

  it('accepts no arguments for root()', (t) => {
    let { $, cleanup } = render(
      <form.Context>
        <form mix={form.root()} />
      </form.Context>,
    )
    t.after(cleanup)
    assert.ok($('form'))
  })
})

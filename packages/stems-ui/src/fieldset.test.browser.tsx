import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { createRoot, type Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as field from './field.ts'
import * as fieldset from './fieldset.ts'

describe('fieldset', () => {
  it('names a native fieldset with a native legend', async (t) => {
    let { $, act, cleanup } = render(
      <fieldset.Context>
        <fieldset mix={fieldset.root()}>
          <legend mix={fieldset.legend()}>Billing</legend>
        </fieldset>
      </fieldset.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let root = $('fieldset')!
    assert.ok($('legend')!.id)
    assert.equal(root.hasAttribute('aria-labelledby'), false)
    assert.equal(root.hasAttribute('role'), false)
    assert.equal(root.hasAttribute('data-disabled'), false)
  })

  it('points aria-labelledby at a non-native legend', async (t) => {
    let { $, act, cleanup } = render(
      <fieldset.Context>
        <fieldset mix={fieldset.root()}>
          <div mix={fieldset.legend()}>Billing</div>
        </fieldset>
      </fieldset.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let legend = $('fieldset > div')!
    assert.equal($('fieldset')!.getAttribute('aria-labelledby'), legend.id)
  })

  it('uses role="group" and aria-disabled for a non-fieldset root', async (t) => {
    let { $, act, cleanup } = render(
      <fieldset.Context disabled>
        <div id="root" mix={fieldset.root()}>
          <div id="legend" mix={fieldset.legend()}>
            Billing
          </div>
        </div>
      </fieldset.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let root = $('#root')!
    assert.equal(root.getAttribute('role'), 'group')
    assert.equal(root.getAttribute('aria-disabled'), 'true')
    assert.equal(root.getAttribute('aria-labelledby'), 'legend')
    assert.equal($('#legend')!.hasAttribute('data-disabled'), true)
  })

  it('disables the native fieldset and the fields inside, including nested fieldsets', (t) => {
    let { $, cleanup } = render(
      <fieldset.Context disabled>
        <fieldset mix={fieldset.root()}>
          <legend mix={fieldset.legend()}>Billing</legend>
          <fieldset.Context>
            <div id="inner" mix={fieldset.root()}>
              <field.Context>
                <div id="field" mix={field.root()}>
                  <input mix={field.control()} />
                </div>
              </field.Context>
            </div>
          </fieldset.Context>
        </fieldset>
      </fieldset.Context>,
    )
    t.after(cleanup)
    assert.equal(($('fieldset') as HTMLFieldSetElement).disabled, true)
    assert.equal($('legend')!.hasAttribute('data-disabled'), true)
    assert.equal($('#inner')!.getAttribute('aria-disabled'), 'true')
    assert.equal($('#field')!.hasAttribute('data-disabled'), true)
    assert.equal(($('input') as HTMLInputElement).disabled, true)
  })

  it('updates when disabled changes', async (t) => {
    let set: (disabled: boolean) => void = () => {}
    function App(handle: Handle) {
      let disabled = false
      set = (next) => {
        disabled = next
        void handle.update()
      }
      return () => (
        <fieldset.Context disabled={disabled}>
          <fieldset mix={fieldset.root()}>
            <field.Context>
              <input mix={field.control()} />
            </field.Context>
          </fieldset>
        </fieldset.Context>
      )
    }
    let { $, act, cleanup } = render(<App />)
    t.after(cleanup)
    assert.equal($('input')!.hasAttribute('data-disabled'), false)
    await act(() => set(true))
    assert.equal($('input')!.hasAttribute('data-disabled'), true)
    assert.equal(($('fieldset') as HTMLFieldSetElement).disabled, true)
  })

  it('keeps a host legend id', async (t) => {
    let { $, act, cleanup } = render(
      <fieldset.Context>
        <fieldset mix={fieldset.root()}>
          <div id="custom" mix={fieldset.legend()}>
            Billing
          </div>
        </fieldset>
      </fieldset.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    assert.equal($('fieldset')!.getAttribute('aria-labelledby'), 'custom')
  })

  it('throws when a part is rendered outside fieldset.Context', (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    let errors: unknown[] = []
    root.addEventListener('error', (event) => void errors.push((event as ErrorEvent).error))
    t.after(() => {
      root.dispose()
      container.remove()
    })
    root.render(<legend mix={fieldset.legend()} />)
    root.flush()
    assert.match(String(errors[0]), /fieldset\.legend\(\) must be rendered inside/)
  })
})

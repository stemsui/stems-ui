import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as field from './field.ts'
import * as form from './form.ts'

describe('form (server)', () => {
  it('renders a plain native form (no novalidate) so it works without JavaScript', async () => {
    let html = await renderToString(
      <form.Context>
        <form method="post" mix={form.root()}>
          <field.Context name="email">
            <input type="email" required mix={field.control()} />
          </field.Context>
        </form>
      </form.Context>,
    )
    assert.match(html, /<form method="post">/)
    assert.match(html, /<input[^>]*required/)
  })

  it('maps errors onto fields by name', async () => {
    let html = await renderToString(
      <form.Context errors={{ email: ['Blocked', 'Try another'], other: 'x' }}>
        <form mix={form.root()}>
          <field.Context name="email">
            <input mix={field.control()} />
            <ul>
              <field.Validity>
                {(state) => state.errors.map((error) => <li>{error}</li>)}
              </field.Validity>
            </ul>
          </field.Context>
          <field.Context name="name">
            <input id="name" mix={field.control()} />
          </field.Context>
        </form>
      </form.Context>,
    )
    assert.match(html, /<li>Blocked<\/li><li>Try another<\/li>/)
    assert.doesNotMatch(html, /<input id="name"[^>]*aria-invalid/)
  })
})

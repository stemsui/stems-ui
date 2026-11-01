import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as fieldset from './fieldset.ts'

describe('fieldset (server)', () => {
  it('renders a native fieldset and legend', async () => {
    let html = await renderToString(
      <fieldset.Context>
        <fieldset mix={fieldset.root()}>
          <legend mix={fieldset.legend()}>Billing</legend>
        </fieldset>
      </fieldset.Context>,
    )
    assert.match(html, /<fieldset><legend id="[^"]+">Billing<\/legend><\/fieldset>/)
  })

  it('renders the disabled state on both parts', async () => {
    let html = await renderToString(
      <fieldset.Context disabled>
        <div mix={fieldset.root()}>
          <div mix={fieldset.legend()}>Billing</div>
        </div>
      </fieldset.Context>,
    )
    assert.match(html, /<div role="group" aria-disabled="true" data-disabled="">/)
    assert.match(html, /<div id="[^"]+" data-disabled="">Billing/)
  })
})

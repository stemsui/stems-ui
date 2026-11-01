import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { render } from 'remix/component/test'

import { separator } from './separator.ts'

describe('separator', () => {
  it('sets separator semantics on a generic host', (t) => {
    let { $, cleanup } = render(<div mix={separator()} />)
    t.after(cleanup)

    let host = $('div')
    assert.ok(host)
    assert.equal(host.getAttribute('role'), 'separator')
    assert.equal(host.getAttribute('aria-orientation'), null)
    assert.equal(host.getAttribute('data-orientation'), 'horizontal')
  })

  it('marks vertical separators', (t) => {
    let { $, cleanup } = render(<div mix={separator({ orientation: 'vertical' })} />)
    t.after(cleanup)

    let host = $('div')
    assert.ok(host)
    assert.equal(host.getAttribute('aria-orientation'), 'vertical')
    assert.equal(host.getAttribute('data-orientation'), 'vertical')
  })

  it('keeps the implicit role of <hr>', (t) => {
    let { $, cleanup } = render(<hr mix={separator()} />)
    t.after(cleanup)

    let host = $('hr')
    assert.ok(host)
    assert.equal(host.getAttribute('role'), null)
  })

  it('hides decorative separators from assistive technology', (t) => {
    let { $, cleanup } = render(<div mix={separator({ decorative: true })} />)
    t.after(cleanup)

    let host = $('div')
    assert.ok(host)
    assert.equal(host.getAttribute('aria-hidden'), 'true')
    assert.equal(host.getAttribute('role'), null)
  })

  it('lets explicit host props win', (t) => {
    let { $, cleanup } = render(<div role="presentation" mix={separator()} />)
    t.after(cleanup)

    assert.equal($('div')?.getAttribute('role'), 'presentation')
  })
})

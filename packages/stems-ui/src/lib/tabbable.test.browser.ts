import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { focusFirst, getTabbableElements } from './tabbable.ts'

function mount(t: { after(fn: () => void): void }, html: string) {
  let root = document.createElement('div')
  root.innerHTML = html
  document.body.append(root)
  t.after(() => root.remove())
  return root
}

describe('tabbable', () => {
  it('finds tabbable elements in DOM order and skips unreachable ones', (t) => {
    let root = mount(
      t,
      `<button id="a">a</button>
       <button id="disabled" disabled>x</button>
       <a id="nohref">x</a>
       <a id="b" href="#">b</a>
       <div id="negative" tabindex="-1">x</div>
       <div hidden><button id="hidden">x</button></div>
       <div inert><button id="inert">x</button></div>
       <div style="display:none"><input id="none" /></div>
       <input id="c" />
       <div id="d" tabindex="0">d</div>`,
    )

    assert.deepEqual(
      getTabbableElements(root).map((node) => node.id),
      ['a', 'b', 'c', 'd'],
    )
  })

  it('focuses [autofocus] first, then the first tabbable, then the root', (t) => {
    let withAutofocus = mount(t, `<button>first</button><input id="auto" autofocus />`)
    assert.equal(focusFirst(withAutofocus).id, 'auto')
    assert.equal(document.activeElement?.id, 'auto')

    let plain = mount(t, `<p>text</p><button id="btn">go</button>`)
    assert.equal(focusFirst(plain).id, 'btn')

    let empty = mount(t, `<p>nothing focusable</p>`)
    assert.equal(focusFirst(empty), empty)
    assert.equal(empty.getAttribute('tabindex'), '-1')
    assert.equal(document.activeElement, empty)
  })
})

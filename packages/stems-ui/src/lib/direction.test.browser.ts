import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { getDirection, horizontalArrowStep } from './direction.ts'

describe('getDirection', () => {
  it('defaults to ltr', (t) => {
    let node = document.createElement('div')
    document.body.append(node)
    t.after(() => node.remove())

    assert.equal(getDirection(node), 'ltr')
    assert.equal(getDirection(null), 'ltr')
  })

  it('uses the nearest dir attribute', (t) => {
    let outer = document.createElement('div')
    outer.setAttribute('dir', 'rtl')
    let inner = document.createElement('span')
    outer.append(inner)
    document.body.append(outer)
    t.after(() => outer.remove())

    assert.equal(getDirection(inner), 'rtl')

    inner.setAttribute('dir', 'ltr')
    assert.equal(getDirection(inner), 'ltr')
  })

  it('falls back to computed direction', (t) => {
    let node = document.createElement('div')
    node.style.direction = 'rtl'
    document.body.append(node)
    t.after(() => node.remove())

    assert.equal(getDirection(node), 'rtl')
  })
})

describe('horizontalArrowStep', () => {
  it('flips horizontal arrows in rtl', () => {
    assert.equal(horizontalArrowStep('ArrowRight', 'ltr'), 1)
    assert.equal(horizontalArrowStep('ArrowLeft', 'ltr'), -1)
    assert.equal(horizontalArrowStep('ArrowRight', 'rtl'), -1)
    assert.equal(horizontalArrowStep('ArrowLeft', 'rtl'), 1)
    assert.equal(horizontalArrowStep('ArrowDown', 'ltr'), 0)
  })
})

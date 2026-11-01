import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { getRovingMove, getRovingTargetIndex } from './roving-focus.ts'

describe('getRovingMove', () => {
  it('maps arrows per orientation', () => {
    assert.equal(getRovingMove('ArrowRight', 'horizontal', 'ltr'), 'next')
    assert.equal(getRovingMove('ArrowLeft', 'horizontal', 'ltr'), 'previous')
    assert.equal(getRovingMove('ArrowDown', 'horizontal', 'ltr'), null)
    assert.equal(getRovingMove('ArrowDown', 'vertical', 'ltr'), 'next')
    assert.equal(getRovingMove('ArrowUp', 'vertical', 'ltr'), 'previous')
    assert.equal(getRovingMove('ArrowRight', 'vertical', 'ltr'), null)
    assert.equal(getRovingMove('ArrowDown', 'both', 'ltr'), 'next')
    assert.equal(getRovingMove('ArrowRight', 'both', 'ltr'), 'next')
  })

  it('mirrors horizontal arrows in RTL', () => {
    assert.equal(getRovingMove('ArrowLeft', 'horizontal', 'rtl'), 'next')
    assert.equal(getRovingMove('ArrowRight', 'horizontal', 'rtl'), 'previous')
  })

  it('maps Home and End', () => {
    assert.equal(getRovingMove('Home', 'vertical', 'ltr'), 'first')
    assert.equal(getRovingMove('End', 'horizontal', 'rtl'), 'last')
    assert.equal(getRovingMove('a', 'both', 'ltr'), null)
  })
})

describe('getRovingTargetIndex', () => {
  let enabled = [true, false, true, true]
  let options = (loop: boolean) => ({ loop, isEnabled: (i: number) => enabled[i] })

  it('skips disabled items', () => {
    assert.equal(getRovingTargetIndex(4, 0, 'next', options(true)), 2)
    assert.equal(getRovingTargetIndex(4, 2, 'previous', options(true)), 0)
  })

  it('wraps when looping and stops otherwise', () => {
    assert.equal(getRovingTargetIndex(4, 3, 'next', options(true)), 0)
    assert.equal(getRovingTargetIndex(4, 0, 'previous', options(true)), 3)
    assert.equal(getRovingTargetIndex(4, 3, 'next', options(false)), 3)
    assert.equal(getRovingTargetIndex(4, 0, 'previous', options(false)), 0)
  })

  it('finds the first and last enabled items', () => {
    let disabledEnds = [false, true, true, false]
    let opts = { loop: true, isEnabled: (i: number) => disabledEnds[i] }
    assert.equal(getRovingTargetIndex(4, 1, 'first', opts), 1)
    assert.equal(getRovingTargetIndex(4, 1, 'last', opts), 2)
  })

  it('handles nothing focused and nothing enabled', () => {
    assert.equal(getRovingTargetIndex(4, -1, 'next', options(true)), 0)
    assert.equal(getRovingTargetIndex(4, -1, 'previous', options(true)), 3)
    assert.equal(getRovingTargetIndex(3, 0, 'next', { loop: true, isEnabled: () => false }), 0)
    assert.equal(getRovingTargetIndex(0, -1, 'first', { loop: true }), -1)
  })
})

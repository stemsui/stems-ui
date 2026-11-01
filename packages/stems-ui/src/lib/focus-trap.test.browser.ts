import { expect } from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { inertOthers, trapFocus } from './focus-trap.ts'

function key(target: Element, shiftKey = false) {
  let event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'Tab',
    shiftKey,
  })
  target.dispatchEvent(event)
  return event
}

function fixture() {
  document.body.innerHTML = `
    <button id="before">Before</button>
    <section id="wrap">
      <span id="sibling">Sibling</span>
      <div id="container" tabindex="-1">
        <button id="a">A</button>
        <button id="b">B</button>
        <div id="inner" tabindex="-1"><button id="c">C</button><button id="d">D</button></div>
      </div>
    </section>
    <div id="live" aria-live="polite"></div>
    <div id="preinert" inert></div>
  `
  let get = (id: string) => document.getElementById(id)!
  return get
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('trapFocus', () => {
  it('wraps Tab and Shift+Tab at the edges only', () => {
    let get = fixture()
    let release = trapFocus(get('container'))

    get('d').focus()
    expect(key(get('d')).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(get('a'))

    expect(key(get('a'), true).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(get('d'))

    get('b').focus()
    expect(key(get('b')).defaultPrevented).toBe(false)

    get('container').focus()
    expect(key(get('container'), true).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(get('d'))

    release()
    get('d').focus()
    expect(key(get('d')).defaultPrevented).toBe(false)
  })

  it('keeps focus on an empty container', () => {
    document.body.innerHTML = '<div id="empty" tabindex="-1">Nothing</div>'
    let empty = document.getElementById('empty')!
    let release = trapFocus(empty)
    empty.focus()
    expect(key(empty).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(empty)
    release()
  })

  it('lets the innermost of nested traps handle the key', () => {
    let get = fixture()
    let releaseOuter = trapFocus(get('container'))
    let releaseInner = trapFocus(get('inner'))

    get('d').focus()
    key(get('d'))
    expect(document.activeElement).toBe(get('c'))

    releaseInner()
    releaseOuter()
  })
})

describe('inertOthers', () => {
  it('makes everything but the kept subtrees inert and restores it', () => {
    let get = fixture()
    let restore = inertOthers([get('container')])

    expect(get('before').hasAttribute('inert')).toBe(true)
    expect(get('sibling').hasAttribute('inert')).toBe(true)
    expect(get('wrap').hasAttribute('inert')).toBe(false)
    expect(get('container').hasAttribute('inert')).toBe(false)
    expect(get('live').hasAttribute('inert')).toBe(false)

    restore()
    expect(get('before').hasAttribute('inert')).toBe(false)
    expect(get('sibling').hasAttribute('inert')).toBe(false)
    expect(get('preinert').hasAttribute('inert')).toBe(true)
  })

  it('nests: elements stay inert until every call is undone', () => {
    let get = fixture()
    let outer = inertOthers([get('container')])
    let inner = inertOthers([get('inner')])

    expect(get('a').hasAttribute('inert')).toBe(true)
    expect(get('before').hasAttribute('inert')).toBe(true)

    inner()
    expect(get('a').hasAttribute('inert')).toBe(false)
    expect(get('before').hasAttribute('inert')).toBe(true)

    outer()
    expect(get('before').hasAttribute('inert')).toBe(false)
  })
})

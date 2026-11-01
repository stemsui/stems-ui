import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { isTopDismissLayer, registerDismissLayer, type DismissReason } from './dismiss-layer.ts'

type T = { after(fn: () => void): void }

function element(t: T, parent: HTMLElement = document.body) {
  let node = document.createElement('div')
  node.textContent = 'layer'
  parent.append(node)
  t.after(() => node.remove())
  return node
}

function escape(target: EventTarget = document.body) {
  let event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

function press(target: HTMLElement) {
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  target.click()
}

function layer(
  t: T,
  node: HTMLElement,
  options: Partial<Parameters<typeof registerDismissLayer>[0]> = {},
) {
  let calls: DismissReason[] = []
  let unregister = registerDismissLayer({
    node,
    onDismiss: (reason) => calls.push(reason),
    ...options,
  })
  t.after(unregister)
  return { calls, unregister }
}

describe('dismiss layers', () => {
  it('dismisses only the top layer on Escape and stops the event', (t) => {
    let outer = layer(t, element(t))
    let inner = layer(t, element(t))
    let reachedBubble = false
    let onKey = () => (reachedBubble = true)
    document.addEventListener('keydown', onKey)
    t.after(() => document.removeEventListener('keydown', onKey))

    let event = escape()

    assert.deepEqual(inner.calls, ['escape-key'])
    assert.deepEqual(outer.calls, [])
    assert.equal(event.defaultPrevented, true)
    assert.equal(reachedBubble, false)
  })

  it('skips layers that ignore Escape', (t) => {
    let outer = layer(t, element(t))
    let inner = layer(t, element(t), { dismissOnEscape: false })

    escape()

    assert.deepEqual(inner.calls, [])
    assert.deepEqual(outer.calls, ['escape-key'])
  })

  it('does nothing on Escape when there are no layers', () => {
    let event = escape()
    assert.equal(event.defaultPrevented, false)
  })

  it('closes child layers when pressing inside a parent', (t) => {
    let parentNode = element(t)
    let parent = layer(t, parentNode)
    let child = layer(t, element(t))

    press(parentNode)

    assert.deepEqual(child.calls, ['outside-press'])
    assert.deepEqual(parent.calls, [])
  })

  it('closes every layer when pressing outside all of them', (t) => {
    let outside = element(t)
    let parent = layer(t, element(t))
    let child = layer(t, element(t))

    press(outside)

    assert.deepEqual(child.calls, ['outside-press'])
    assert.deepEqual(parent.calls, ['outside-press'])
  })

  it('treats presses inside a nested child element as inside', (t) => {
    let parentNode = element(t)
    let childNode = element(t, parentNode)
    let parent = layer(t, parentNode)
    let child = layer(t, childNode)

    press(childNode)

    assert.deepEqual(child.calls, [])
    assert.deepEqual(parent.calls, [])
  })

  it('uses a custom contains test (e.g. for the trigger)', (t) => {
    let trigger = element(t)
    let popup = layer(t, element(t), {
      contains: (target) => trigger.contains(target) || undefined,
    })

    press(trigger)

    assert.deepEqual(popup.calls, [])
  })

  it('stops the walk at a layer that ignores outside presses', (t) => {
    let outside = element(t)
    let below = layer(t, element(t))
    let modal = layer(t, element(t), { dismissOnOutsidePress: false })

    press(outside)

    assert.deepEqual(modal.calls, [])
    assert.deepEqual(below.calls, [])
  })

  it('uses the pointerdown target so drags that end outside are ignored', (t) => {
    let inside = element(t)
    let outside = element(t)
    let popup = layer(t, inside)

    inside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    outside.click()

    assert.deepEqual(popup.calls, [])
  })

  it('ignores disconnected layers and reports the top layer', (t) => {
    let lower = element(t)
    let upper = element(t)
    let below = layer(t, lower)
    layer(t, upper)
    assert.equal(isTopDismissLayer(upper), true)
    assert.equal(isTopDismissLayer(lower), false)

    upper.remove()
    escape()

    assert.deepEqual(below.calls, ['escape-key'])
  })

  it('unregisters', (t) => {
    let node = element(t)
    let popup = layer(t, node)
    popup.unregister()

    escape()
    assert.deepEqual(popup.calls, [])
    assert.equal(isTopDismissLayer(node), false)
  })
})

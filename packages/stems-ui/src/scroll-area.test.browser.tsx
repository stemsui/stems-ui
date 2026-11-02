import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'

import { DirectionProvider } from './direction-provider.ts'
import * as scrollArea from './scroll-area.ts'

async function waitFor(check: () => boolean, timeout = 2000) {
  let start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error('Timed out waiting for condition')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

function frame() {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
}

function pointer(target: Element, type: string, init: PointerEventInit = {}) {
  let event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

interface FixtureProps {
  width?: number
  height?: number
  overflowEdgeThreshold?: scrollArea.OverflowEdgeThreshold
  keepMounted?: boolean
  viewportTabIndex?: number
  inferThumbOrientation?: boolean
  onContext?: (value: scrollArea.ScrollAreaContextValue) => void
}

function Probe(handle: Handle<{ onContext?: FixtureProps['onContext']; children?: RemixNode }>) {
  return () => {
    handle.props.onContext?.(handle.context.get(scrollArea.Context))
    return handle.props.children
  }
}

function Fixture(handle: Handle<FixtureProps>) {
  return () => {
    let {
      width = 400,
      height = 400,
      keepMounted,
      viewportTabIndex,
      inferThumbOrientation,
    } = handle.props
    return (
      <scrollArea.Context overflowEdgeThreshold={handle.props.overflowEdgeThreshold}>
        <Probe onContext={handle.props.onContext}>
          <div data-part="root" style={{ width: '200px', height: '100px' }} mix={scrollArea.root()}>
            <div
              data-part="viewport"
              style={{ width: '100%', height: '100%' }}
              tabIndex={viewportTabIndex}
              mix={scrollArea.viewport()}
            >
              <div data-part="content" mix={scrollArea.content()}>
                <div data-part="inner" style={{ width: `${width}px`, height: `${height}px` }} />
              </div>
            </div>
            <div
              data-part="scrollbar-y"
              style={{ width: '10px' }}
              mix={scrollArea.scrollbar({ keepMounted })}
            >
              <div data-part="thumb-y" style={{ width: '100%' }} mix={scrollArea.thumb()} />
            </div>
            <div
              data-part="scrollbar-x"
              style={{ height: '10px' }}
              mix={scrollArea.scrollbar({ orientation: 'horizontal', keepMounted })}
            >
              <div
                data-part="thumb-x"
                style={{ height: '100%' }}
                mix={scrollArea.thumb(
                  inferThumbOrientation ? undefined : { orientation: 'horizontal' },
                )}
              />
            </div>
            <div data-part="corner" mix={scrollArea.corner()} />
          </div>
        </Probe>
      </scrollArea.Context>
    )
  }
}

function setup(node: RemixNode) {
  let result = render(node)
  let part = (name: string) => result.$(`[data-part="${name}"]`) as HTMLElement
  return { ...result, part }
}

function px(element: HTMLElement, name: string) {
  return parseFloat(element.style.getPropertyValue(name))
}

function translate(element: HTMLElement): [number, number] {
  let match = element.style.transform.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/)
  assert.ok(match, `no transform: ${element.style.transform}`)
  return [Number(match[1]), Number(match[2])]
}

describe('scroll-area', () => {
  it('measures overflow after mount', async (t) => {
    let { part, cleanup } = setup(<Fixture />)
    t.after(cleanup)

    let root = part('root')
    await waitFor(() => root.hasAttribute('data-has-overflow-y'))
    await frame()

    for (let name of ['root', 'viewport', 'content', 'scrollbar-y', 'scrollbar-x']) {
      let element = part(name)
      assert.equal(element.getAttribute('data-has-overflow-x'), '', name)
      assert.equal(element.getAttribute('data-has-overflow-y'), '', name)
      assert.equal(element.getAttribute('data-overflow-y-end'), '', name)
      assert.equal(element.hasAttribute('data-overflow-y-start'), false, name)
      assert.equal(element.getAttribute('data-overflow-x-end'), '', name)
      assert.equal(element.hasAttribute('data-overflow-x-start'), false, name)
    }
    assert.equal(root.getAttribute('role'), 'presentation')
    assert.equal(part('content').getAttribute('role'), 'presentation')
    assert.equal(part('viewport').tabIndex, 0)

    let scrollbarY = part('scrollbar-y')
    let scrollbarX = part('scrollbar-x')
    assert.equal(scrollbarY.hidden, false)
    assert.equal(scrollbarX.hidden, false)
    assert.equal(scrollbarY.getAttribute('aria-hidden'), 'true')
    assert.equal(scrollbarY.getAttribute('data-orientation'), 'vertical')
    assert.equal(scrollbarX.getAttribute('data-orientation'), 'horizontal')

    let corner = part('corner')
    assert.equal(corner.hidden, false)
    assert.equal(corner.style.width, '10px')
    assert.equal(corner.style.height, '10px')
    assert.equal(px(root, '--scroll-area-corner-width'), 10)
    assert.equal(px(root, '--scroll-area-corner-height'), 10)

    // Tracks end at the corner: 90px long. Vertical ratio 100/400, horizontal 200/400.
    assert.equal(scrollbarY.offsetHeight, 90)
    assert.equal(px(scrollbarY, '--scroll-area-thumb-height'), 22.5)
    assert.equal(px(scrollbarX, '--scroll-area-thumb-width'), 95)
    assert.equal(part('thumb-y').offsetHeight, 23)
    assert.equal(part('thumb-y').style.visibility, '')
    assert.deepEqual(translate(part('thumb-y')), [0, 0])
  })

  it('tracks overflow edges, CSS variables and the thumb position on scroll', async (t) => {
    let { part, cleanup } = setup(<Fixture />)
    t.after(cleanup)
    let root = part('root')
    let viewport = part('viewport')
    await waitFor(() => root.hasAttribute('data-has-overflow-y'))

    viewport.scrollTop = 50
    await waitFor(() => root.hasAttribute('data-overflow-y-start'))
    assert.equal(root.getAttribute('data-overflow-y-end'), '')
    assert.equal(px(viewport, '--scroll-area-overflow-y-start'), 50)
    assert.equal(px(viewport, '--scroll-area-overflow-y-end'), 250)
    assert.equal(px(viewport, '--scroll-area-overflow-x-start'), 0)
    assert.equal(px(viewport, '--scroll-area-overflow-x-end'), 200)
    // (90 - 22.5) * 50 / 300
    assert.equal(translate(part('thumb-y'))[1], 11.25)

    viewport.scrollTop = 300
    await waitFor(() => !root.hasAttribute('data-overflow-y-end'))
    assert.equal(translate(part('thumb-y'))[1], 67.5)

    viewport.scrollLeft = 200
    await waitFor(() => root.hasAttribute('data-overflow-x-start'))
    assert.equal(root.hasAttribute('data-overflow-x-end'), false)
    assert.equal(translate(part('thumb-x'))[0], 95)
  })

  it('sets data-scrolling for user scrolls only', async (t) => {
    let { part, cleanup } = setup(<Fixture />)
    t.after(cleanup)
    let root = part('root')
    let viewport = part('viewport')
    await waitFor(() => root.hasAttribute('data-has-overflow-y'))

    viewport.scrollTop = 40
    await waitFor(() => root.hasAttribute('data-overflow-y-start'))
    await frame()
    assert.equal(root.hasAttribute('data-scrolling'), false)

    viewport.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 40 }))
    viewport.scrollTop = 80
    await waitFor(() => root.hasAttribute('data-scrolling'))
    for (let name of ['root', 'viewport', 'content', 'scrollbar-y', 'thumb-y']) {
      assert.equal(part(name).getAttribute('data-scrolling'), '', name)
    }
    assert.equal(part('scrollbar-x').hasAttribute('data-scrolling'), false)
    assert.equal(part('thumb-x').hasAttribute('data-scrolling'), false)

    await waitFor(() => !root.hasAttribute('data-scrolling'), 1500)
    assert.equal(part('scrollbar-y').hasAttribute('data-scrolling'), false)
  })

  it('hides scrollbars without overflow and reacts to content size changes', async (t) => {
    let { part, act, cleanup } = setup(<Fixture width={100} height={50} />)
    t.after(cleanup)
    let root = part('root')
    let viewport = part('viewport')
    await frame()
    await frame()

    assert.equal(part('scrollbar-y').hidden, true)
    assert.equal(part('scrollbar-x').hidden, true)
    assert.equal(part('corner').hidden, true)
    assert.equal(viewport.tabIndex, -1)
    assert.equal(root.hasAttribute('data-has-overflow-y'), false)
    assert.equal(part('thumb-y').style.visibility, '')

    // Resize the content without re-rendering: the ResizeObserver picks it up.
    await act(() => {
      part('inner').style.height = '300px'
    })
    await waitFor(() => root.hasAttribute('data-has-overflow-y'))
    assert.equal(part('scrollbar-y').hidden, false)
    assert.equal(part('scrollbar-x').hidden, true)
    assert.equal(part('corner').hidden, true)
    assert.equal(viewport.tabIndex, 0)
    await frame()
    // Without a horizontal scrollbar the vertical track is full height.
    assert.equal(part('scrollbar-y').offsetHeight, 100)
    assert.ok(Math.abs(px(part('scrollbar-y'), '--scroll-area-thumb-height') - 100 / 3) < 0.001)
  })

  it('keeps scrollbars visible with keepMounted', async (t) => {
    let { part, cleanup } = setup(<Fixture width={100} height={50} keepMounted />)
    t.after(cleanup)
    await frame()
    await frame()
    assert.equal(part('scrollbar-y').hidden, false)
    assert.equal(part('scrollbar-x').hidden, false)
    assert.equal(part('root').hasAttribute('data-has-overflow-y'), false)
  })

  it('sets data-hovering on scrollbars while a mouse is over the root', async (t) => {
    let { part, cleanup } = setup(<Fixture />)
    t.after(cleanup)
    let root = part('root')
    await waitFor(() => root.hasAttribute('data-has-overflow-y'))

    pointer(part('inner'), 'pointermove')
    assert.equal(part('scrollbar-y').getAttribute('data-hovering'), '')
    assert.equal(part('scrollbar-x').getAttribute('data-hovering'), '')
    assert.equal(root.hasAttribute('data-hovering'), false)

    root.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))
    assert.equal(part('scrollbar-y').hasAttribute('data-hovering'), false)

    pointer(part('inner'), 'pointermove', { pointerType: 'touch' })
    assert.equal(part('scrollbar-y').hasAttribute('data-hovering'), false)
  })

  it('scrolls by dragging the thumb', async (t) => {
    let { part, cleanup } = setup(<Fixture />)
    t.after(cleanup)
    let root = part('root')
    let viewport = part('viewport')
    let thumb = part('thumb-y')
    await waitFor(() => root.hasAttribute('data-has-overflow-y'))
    await frame()

    pointer(thumb, 'pointerdown', { clientY: 10 })
    // Half of the 67.5px thumb travel scrolls half of the 300px range.
    let move = pointer(thumb, 'pointermove', { clientY: 10 + 33.75 })
    assert.equal(move.defaultPrevented, true)
    assert.equal(viewport.scrollTop, 150)
    assert.equal(part('scrollbar-y').getAttribute('data-scrolling'), '')

    pointer(thumb, 'pointermove', { clientY: 10 + 1000 })
    assert.equal(viewport.scrollTop, 300)

    pointer(thumb, 'pointerup', { clientY: 10 + 1000 })
    assert.equal(part('scrollbar-y').hasAttribute('data-scrolling'), false)
    pointer(thumb, 'pointermove', { clientY: 0 })
    assert.equal(viewport.scrollTop, 300)
  })

  it('ends a drag on a move without buttons', async (t) => {
    let { part, cleanup } = setup(<Fixture />)
    t.after(cleanup)
    let viewport = part('viewport')
    let thumb = part('thumb-x')
    await waitFor(() => part('root').hasAttribute('data-has-overflow-x'))
    await frame()

    pointer(thumb, 'pointerdown', { clientX: 10 })
    pointer(thumb, 'pointermove', { clientX: 10 + 47.5 })
    assert.equal(viewport.scrollLeft, 100)
    pointer(thumb, 'pointermove', { clientX: 200, buttons: 0 })
    assert.equal(viewport.scrollLeft, 100)
  })

  it('jumps to a pressed track position and ignores other buttons', async (t) => {
    let { part, cleanup } = setup(<Fixture />)
    t.after(cleanup)
    let viewport = part('viewport')
    let scrollbar = part('scrollbar-y')
    await waitFor(() => part('root').hasAttribute('data-has-overflow-y'))
    await frame()
    let rect = scrollbar.getBoundingClientRect()

    pointer(scrollbar, 'pointerdown', { clientX: rect.left + 5, clientY: rect.top + 45, button: 2 })
    assert.equal(viewport.scrollTop, 0)

    // Center the thumb on the press: (45 - 11.25) / 67.5 of the range.
    pointer(scrollbar, 'pointerdown', { clientX: rect.left + 5, clientY: rect.top + 45 })
    assert.equal(viewport.scrollTop, 150)
    pointer(scrollbar, 'pointerup')

    let mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    scrollbar.dispatchEvent(mousedown)
    assert.equal(mousedown.defaultPrevented, true)
  })

  it('scrolls the viewport when wheeling over a scrollbar', async (t) => {
    let { part, cleanup } = setup(<Fixture />)
    t.after(cleanup)
    let viewport = part('viewport')
    await waitFor(() => part('root').hasAttribute('data-has-overflow-y'))

    let wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 60 })
    part('scrollbar-y').dispatchEvent(wheel)
    assert.equal(wheel.defaultPrevented, true)
    assert.equal(viewport.scrollTop, 60)

    // At the start edge, wheeling up chains to the page.
    viewport.scrollTop = 0
    let up = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -60 })
    part('scrollbar-y').dispatchEvent(up)
    assert.equal(up.defaultPrevented, false)

    let sideways = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 30 })
    part('scrollbar-x').dispatchEvent(sideways)
    assert.equal(viewport.scrollLeft, 30)
  })

  it('mirrors the horizontal scrollbar in RTL', async (t) => {
    let { part, cleanup } = setup(
      <DirectionProvider direction="rtl">
        <Fixture />
      </DirectionProvider>,
    )
    t.after(cleanup)
    let root = part('root')
    let viewport = part('viewport')
    await waitFor(() => root.hasAttribute('data-has-overflow-x'))
    await frame()

    assert.equal(root.getAttribute('data-overflow-x-end'), '')
    assert.equal(root.hasAttribute('data-overflow-x-start'), false)
    // The vertical scrollbar sits on the inline end (left) in RTL.
    assert.ok(
      part('scrollbar-y').getBoundingClientRect().left <= root.getBoundingClientRect().left + 1,
    )

    viewport.scrollLeft = -100
    await waitFor(() => root.hasAttribute('data-overflow-x-start'))
    assert.equal(px(viewport, '--scroll-area-overflow-x-start'), 100)
    // (190 - 95) * 100 / 200, towards the left.
    assert.equal(translate(part('thumb-x'))[0], -47.5)

    // Pressing the left end of the track scrolls to the inline end.
    let rect = part('scrollbar-x').getBoundingClientRect()
    pointer(part('scrollbar-x'), 'pointerdown', { clientX: rect.left + 1, clientY: rect.top + 5 })
    assert.equal(viewport.scrollLeft, -200)
    pointer(part('scrollbar-x'), 'pointerup')
  })

  it('applies overflowEdgeThreshold', async (t) => {
    let { part, cleanup } = setup(<Fixture overflowEdgeThreshold={{ yStart: 20 }} />)
    t.after(cleanup)
    let root = part('root')
    let viewport = part('viewport')
    await waitFor(() => root.hasAttribute('data-has-overflow-y'))

    viewport.scrollTop = 10
    await waitFor(() => px(viewport, '--scroll-area-overflow-y-start') === 10)
    assert.equal(root.hasAttribute('data-overflow-y-start'), false)

    viewport.scrollTop = 30
    await waitFor(() => root.hasAttribute('data-overflow-y-start'))
  })

  it('leaves a host tabIndex alone', async (t) => {
    let { part, cleanup } = setup(<Fixture width={100} height={50} viewportTabIndex={0} />)
    t.after(cleanup)
    await frame()
    await frame()
    assert.equal(part('viewport').tabIndex, 0)
  })

  it('infers a thumb orientation from its scrollbar', async (t) => {
    let { part, cleanup } = setup(<Fixture inferThumbOrientation />)
    t.after(cleanup)
    await waitFor(() => part('thumb-x').getAttribute('data-orientation') === 'horizontal')
    let thumb = part('thumb-x')
    assert.equal(thumb.style.width, 'var(--scroll-area-thumb-width)')
    assert.equal(thumb.style.height, '100%')
  })

  it('exposes state and measure() through the context', async (t) => {
    let context: scrollArea.ScrollAreaContextValue | undefined
    let { part, cleanup } = setup(<Fixture onContext={(value) => (context = value)} />)
    t.after(cleanup)
    await waitFor(() => part('root').hasAttribute('data-has-overflow-y'))
    assert.ok(context)
    assert.equal(context.state.hasOverflowY, true)
    assert.equal(context.state.overflowYEnd, true)
    assert.equal(context.state.cornerHidden, false)
    assert.equal(context.state.scrolling, false)

    part('viewport').scrollTop = 30
    context.measure()
    assert.equal(context.state.overflowYStart, true)
    assert.equal(part('root').getAttribute('data-overflow-y-start'), '')
  })

  it('keeps measured state across app re-renders', async (t) => {
    let { part, act, cleanup } = setup(<Fixture />)
    t.after(cleanup)
    let root = part('root')
    await waitFor(() => root.hasAttribute('data-has-overflow-y'))
    part('viewport').scrollTop = 50
    await waitFor(() => root.hasAttribute('data-overflow-y-start'))

    let host = root.parentElement!
    await act(() => {
      // Re-render the fixture with the same props.
      host.dispatchEvent(new Event('noop'))
    })
    assert.equal(root.getAttribute('data-overflow-y-start'), '')
    assert.equal(part('scrollbar-y').hidden, false)
    assert.equal(px(part('scrollbar-y'), '--scroll-area-thumb-height'), 22.5)
  })
})

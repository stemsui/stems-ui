import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as avatar from './avatar.ts'

const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
const BROKEN = 'data:image/png;base64,bm90IGFuIGltYWdl'

async function waitFor(check: () => boolean, timeout = 2000) {
  let start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error('Timed out waiting for condition')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

function Avatar(
  handle: Handle<{
    src?: string
    delay?: number
    keepMounted?: boolean
    statuses?: avatar.ImageLoadingStatus[]
  }>,
) {
  return () => {
    let { src, delay, keepMounted, statuses } = handle.props
    return (
      <avatar.Context>
        <span mix={avatar.root()}>
          <img
            alt="Ada Lovelace"
            src={src}
            mix={avatar.image({
              keepMounted,
              onLoadingStatusChange: statuses ? (status) => statuses.push(status) : undefined,
            })}
          />
          <span mix={avatar.fallback({ delay })}>AL</span>
        </span>
      </avatar.Context>
    )
  }
}

describe('avatar', () => {
  it('hides the image and shows the fallback while loading, then swaps', async (t) => {
    let statuses: avatar.ImageLoadingStatus[] = []
    let { $, cleanup } = render(<Avatar src={PIXEL} statuses={statuses} />)
    t.after(cleanup)

    let image = $('img')!
    let fallback = $('span > span')!
    assert.equal(image.hidden, true)
    assert.equal(image.getAttribute('data-loading'), '')
    assert.equal(image.getAttribute('aria-hidden'), 'true')
    assert.equal(fallback.hidden, false)

    await waitFor(() => !image.hidden)
    assert.equal(image.hasAttribute('data-loading'), false)
    assert.equal(image.hasAttribute('aria-hidden'), false)
    assert.equal(fallback.hidden, true)
    assert.deepEqual(statuses, ['loading', 'loaded'])
  })

  it('keeps the fallback and marks the image when it fails to load', async (t) => {
    let statuses: avatar.ImageLoadingStatus[] = []
    let { $, cleanup } = render(<Avatar src={BROKEN} statuses={statuses} />)
    t.after(cleanup)

    let image = $('img')!
    await waitFor(() => image.hasAttribute('data-error'))
    assert.equal(image.hidden, true)
    assert.equal(image.hasAttribute('data-loading'), false)
    assert.equal($('span > span')!.hidden, false)
    assert.deepEqual(statuses, ['loading', 'error'])
  })

  it('shows the fallback when there is no src', (t) => {
    let { $, cleanup } = render(<Avatar />)
    t.after(cleanup)

    assert.equal($('img')!.hidden, true)
    assert.equal($('img')!.hasAttribute('data-loading'), false)
    assert.equal($('span > span')!.hidden, false)
  })

  it('waits for the fallback delay', async (t) => {
    let { $, cleanup } = render(<Avatar src={BROKEN} delay={50} />)
    t.after(cleanup)

    let fallback = $('span > span')!
    assert.equal(fallback.hidden, true)
    await waitFor(() => !fallback.hidden)
  })

  it('never shows a delayed fallback when the image loads first', async (t) => {
    let { $, cleanup } = render(<Avatar src={PIXEL} delay={300} />)
    t.after(cleanup)

    let fallback = $('span > span')!
    await waitFor(() => !$('img')!.hidden)
    await new Promise((resolve) => setTimeout(resolve, 350))
    assert.equal(fallback.hidden, true)
  })

  it('loads in place with keepMounted', async (t) => {
    let { $, cleanup } = render(<Avatar src={PIXEL} keepMounted />)
    t.after(cleanup)

    let image = $('img')!
    assert.equal(image.hidden, false)
    await waitFor(() => !image.hasAttribute('data-loading'))
    assert.equal(image.hasAttribute('data-error'), false)
    assert.equal($('span > span')!.hidden, true)
  })

  it('reports errors with keepMounted', async (t) => {
    let { $, cleanup } = render(<Avatar src={BROKEN} keepMounted />)
    t.after(cleanup)

    await waitFor(() => $('img')!.hasAttribute('data-error'))
    assert.equal($('span > span')!.hidden, false)
  })

  it('restarts loading when src changes', async (t) => {
    let setSrc!: (src: string) => void
    function Harness(handle: Handle) {
      let src = PIXEL
      setSrc = (next) => {
        src = next
        void handle.update()
      }
      return () => <Avatar src={src} />
    }

    let { $, act, cleanup } = render(<Harness />)
    t.after(cleanup)

    await waitFor(() => !$('img')!.hidden)
    await act(() => setSrc(BROKEN))
    await waitFor(() => $('img')!.hasAttribute('data-error'))
    assert.equal($('img')!.hidden, true)
    assert.equal($('span > span')!.hidden, false)
  })

  it('works with no-argument mixins', async (t) => {
    let { $, cleanup } = render(
      <avatar.Context>
        <span mix={avatar.root()}>
          <img alt="" src={PIXEL} mix={avatar.image()} />
          <span mix={avatar.fallback()}>AL</span>
        </span>
      </avatar.Context>,
    )
    t.after(cleanup)

    assert.equal($('span > span')!.hidden, false)
    await waitFor(() => !$('img')!.hidden)
    assert.equal($('span > span')!.hidden, true)
  })

  it('tracks the image without a Context', async (t) => {
    let { $, cleanup } = render(
      <span>
        <img alt="" src={PIXEL} mix={avatar.image()} />
        <span mix={avatar.fallback({ delay: 20 })}>AL</span>
      </span>,
    )
    t.after(cleanup)

    let image = $('img')!
    assert.equal(image.hidden, true)
    await waitFor(() => !image.hidden)
    assert.equal(image.hasAttribute('data-loading'), false)
    assert.equal(image.hasAttribute('aria-hidden'), false)
    // Without a Context the fallback cannot see the image status; it only honors its delay.
    await waitFor(() => !$('span > span')!.hidden)
  })
})

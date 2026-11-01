import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as progress from './progress.ts'

function Progress(handle: Handle<Omit<progress.ProgressContextProps, 'children'>>) {
  return () => (
    <progress.Context {...handle.props}>
      <div data-part="root" mix={progress.root()}>
        <span data-part="label" mix={progress.label()}>
          Export
        </span>
        <span data-part="value" mix={progress.value()}>
          <progress.ValueText />
        </span>
        <div data-part="track" mix={progress.track()}>
          <div data-part="indicator" mix={progress.indicator()} />
        </div>
      </div>
    </progress.Context>
  )
}

const parts = ['root', 'label', 'value', 'track', 'indicator']

describe('progress', () => {
  it('sets progressbar semantics and labelling', (t) => {
    let { $, cleanup } = render(<Progress value={40} />)
    t.after(cleanup)

    let root = $('[data-part=root]')!
    let label = $('[data-part=label]')!
    assert.equal(root.getAttribute('role'), 'progressbar')
    assert.equal(root.getAttribute('aria-valuenow'), '40')
    assert.equal(root.getAttribute('aria-valuemin'), '0')
    assert.equal(root.getAttribute('aria-valuemax'), '100')
    assert.equal(root.getAttribute('aria-valuetext'), '40%')
    assert.ok(label.id)
    assert.equal(root.getAttribute('aria-labelledby'), label.id)
  })

  it('marks every part as progressing', (t) => {
    let { $, cleanup } = render(<Progress value={40} />)
    t.after(cleanup)

    for (let part of parts) {
      let node = $(`[data-part=${part}]`)!
      assert.equal(node.getAttribute('data-progressing'), '', part)
      assert.equal(node.hasAttribute('data-complete'), false, part)
      assert.equal(node.hasAttribute('data-indeterminate'), false, part)
    }
  })

  it('renders the indicator width and value text', (t) => {
    let { $, cleanup } = render(<Progress value={40} />)
    t.after(cleanup)

    let indicator = $('[data-part=indicator]') as HTMLElement
    assert.equal(indicator.style.width, '40%')
    assert.equal($('[data-part=value]')!.textContent, '40%')
    assert.equal($('[data-part=value]')!.getAttribute('aria-hidden'), 'true')
  })

  it('marks completion at max', (t) => {
    let { $, cleanup } = render(<Progress value={100} />)
    t.after(cleanup)

    for (let part of parts) {
      assert.equal($(`[data-part=${part}]`)!.getAttribute('data-complete'), '', part)
    }
  })

  it('supports an indeterminate state', (t) => {
    let { $, cleanup } = render(<Progress value={null} />)
    t.after(cleanup)

    let root = $('[data-part=root]')!
    assert.equal(root.hasAttribute('aria-valuenow'), false)
    assert.equal(root.getAttribute('aria-valuetext'), 'indeterminate progress')
    for (let part of parts) {
      assert.equal($(`[data-part=${part}]`)!.getAttribute('data-indeterminate'), '', part)
    }
    assert.equal(($('[data-part=indicator]') as HTMLElement).style.width, '')
    assert.equal($('[data-part=value]')!.textContent, '')
  })

  it('maps the value into a custom range', (t) => {
    let { $, cleanup } = render(<Progress value={50} min={0} max={200} />)
    t.after(cleanup)

    assert.equal(($('[data-part=indicator]') as HTMLElement).style.width, '25%')
    assert.equal($('[data-part=root]')!.getAttribute('aria-valuemax'), '200')
  })

  it('formats with Intl options and locale', (t) => {
    let { $, cleanup } = render(
      <Progress value={1234.5} max={2000} locale="de-DE" format={{ maximumFractionDigits: 1 }} />,
    )
    t.after(cleanup)

    assert.equal($('[data-part=value]')!.textContent, '1.234,5')
    assert.equal($('[data-part=root]')!.getAttribute('aria-valuetext'), '1.234,5')
  })

  it('uses getAriaValueText', (t) => {
    let { $, cleanup } = render(
      <Progress value={3} max={10} getAriaValueText={(_, value) => `${value} of 10 files`} />,
    )
    t.after(cleanup)

    assert.equal($('[data-part=root]')!.getAttribute('aria-valuetext'), '3 of 10 files')
  })

  it('lets an aria-label replace the label reference', (t) => {
    let { $, cleanup } = render(
      <progress.Context value={10}>
        <div aria-label="Upload" mix={progress.root()} />
      </progress.Context>,
    )
    t.after(cleanup)

    assert.equal($('div')!.hasAttribute('aria-labelledby'), false)
  })

  it('renders custom value text', (t) => {
    let { $, cleanup } = render(
      <progress.Context value={null}>
        <span mix={progress.value()}>
          <progress.ValueText>
            {(formatted, value) => (formatted === null ? 'Waiting' : `${value}`)}
          </progress.ValueText>
        </span>
      </progress.Context>,
    )
    t.after(cleanup)

    assert.equal($('span')!.textContent, 'Waiting')
  })

  it('merges the indicator width with host styles', (t) => {
    let { $, cleanup } = render(
      <progress.Context value={30}>
        <div style={{ backgroundColor: 'red', width: '1px' }} mix={progress.indicator()} />
      </progress.Context>,
    )
    t.after(cleanup)

    let indicator = $('div') as HTMLElement
    assert.equal(indicator.style.width, '30%')
    assert.equal(indicator.style.backgroundColor, 'red')
  })

  it('updates when the value changes', async (t) => {
    let setValue!: (value: number | null) => void
    function Harness(handle: Handle) {
      let value: number | null = 10
      setValue = (next) => {
        value = next
        void handle.update()
      }
      return () => <Progress value={value} />
    }

    let { $, act, cleanup } = render(<Harness />)
    t.after(cleanup)

    await act(() => setValue(70))
    assert.equal($('[data-part=root]')!.getAttribute('aria-valuenow'), '70')
    assert.equal(($('[data-part=indicator]') as HTMLElement).style.width, '70%')
    assert.equal($('[data-part=value]')!.textContent, '70%')

    await act(() => setValue(null))
    assert.equal($('[data-part=root]')!.getAttribute('data-indeterminate'), '')
    assert.equal(($('[data-part=indicator]') as HTMLElement).style.width, '')
  })
})

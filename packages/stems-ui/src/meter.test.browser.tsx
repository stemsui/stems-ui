import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as meter from './meter.ts'

function Meter(handle: Handle<Omit<meter.MeterContextProps, 'children'>>) {
  return () => (
    <meter.Context {...handle.props}>
      <div data-part="root" mix={meter.root()}>
        <span data-part="label" mix={meter.label()}>
          Storage
        </span>
        <span data-part="value" mix={meter.value()}>
          <meter.ValueText />
        </span>
        <div data-part="track" mix={meter.track()}>
          <div data-part="indicator" mix={meter.indicator()} />
        </div>
      </div>
    </meter.Context>
  )
}

describe('meter', () => {
  it('sets meter semantics and labelling', (t) => {
    let { $, cleanup } = render(<Meter value={24} />)
    t.after(cleanup)

    let root = $('[data-part=root]')!
    assert.equal(root.getAttribute('role'), 'meter')
    assert.equal(root.getAttribute('aria-valuenow'), '24')
    assert.equal(root.getAttribute('aria-valuemin'), '0')
    assert.equal(root.getAttribute('aria-valuemax'), '100')
    assert.equal(root.getAttribute('aria-valuetext'), '24%')
    assert.equal(root.getAttribute('aria-labelledby'), $('[data-part=label]')!.id)
  })

  it('has no progress status attributes', (t) => {
    let { $, cleanup } = render(<Meter value={100} />)
    t.after(cleanup)

    let root = $('[data-part=root]')!
    assert.equal(root.hasAttribute('data-complete'), false)
    assert.equal(root.hasAttribute('data-progressing'), false)
  })

  it('renders the indicator width and value text', (t) => {
    let { $, cleanup } = render(<Meter value={3} min={1} max={5} />)
    t.after(cleanup)

    assert.equal(($('[data-part=indicator]') as HTMLElement).style.width, '50%')
    assert.equal($('[data-part=value]')!.textContent, '3%')
    assert.equal($('[data-part=value]')!.getAttribute('aria-hidden'), 'true')
  })

  it('clamps the indicator to the range', (t) => {
    let { $, cleanup } = render(<Meter value={150} />)
    t.after(cleanup)

    assert.equal(($('[data-part=indicator]') as HTMLElement).style.width, '100%')
  })

  it('formats with Intl options and uses getAriaValueText', (t) => {
    let { $, cleanup } = render(
      <Meter
        value={512}
        max={1024}
        locale="en-US"
        format={{ style: 'unit', unit: 'gigabyte' }}
        getAriaValueText={(formatted) => `${formatted} used`}
      />,
    )
    t.after(cleanup)

    assert.equal($('[data-part=value]')!.textContent, '512 GB')
    assert.equal($('[data-part=root]')!.getAttribute('aria-valuetext'), '512 GB used')
  })

  it('renders custom value text', (t) => {
    let { $, cleanup } = render(
      <meter.Context value={7} max={10}>
        <span mix={meter.value()}>
          <meter.ValueText>{(_, value) => `${value}/10`}</meter.ValueText>
        </span>
      </meter.Context>,
    )
    t.after(cleanup)

    assert.equal($('span')!.textContent, '7/10')
  })

  it('updates when the value changes', async (t) => {
    let setValue!: (value: number) => void
    function Harness(handle: Handle) {
      let value = 10
      setValue = (next) => {
        value = next
        void handle.update()
      }
      return () => <Meter value={value} />
    }

    let { $, act, cleanup } = render(<Harness />)
    t.after(cleanup)

    await act(() => setValue(80))
    assert.equal($('[data-part=root]')!.getAttribute('aria-valuenow'), '80')
    assert.equal(($('[data-part=indicator]') as HTMLElement).style.width, '80%')
    assert.equal($('[data-part=value]')!.textContent, '80%')
  })
})

import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { on, type Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as slider from './slider.ts'
import * as field from './field.ts'
import * as fieldset from './fieldset.ts'
import * as form from './form.ts'

function key(target: Element, value: string, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value, ...init })
  target.dispatchEvent(event)
  return event
}

function pointer(target: Element, type: string, clientX: number, clientY = 10) {
  let event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
  })
  target.dispatchEvent(event)
  return event
}

// A 200px wide, 20px tall control at the top-left of the page (left = 0).
const controlStyle =
  'position:fixed;left:0;top:0;width:200px;height:20px;touch-action:none;margin:0;padding:0'
const thumbStyle = 'width:10px;height:10px;display:block'

type BasicProps = slider.SliderContextProps & { thumbs?: number; labelled?: boolean }

function Basic(handle: Handle<BasicProps>) {
  return () => {
    let props = handle.props
    let count = props.thumbs ?? 1
    return (
      <slider.Context {...props}>
        <div mix={slider.root()}>
          {props.labelled ? <span mix={slider.label()}>Volume</span> : null}
          <output mix={slider.value()}>
            <slider.ValueText />
          </output>
          <div style={controlStyle} mix={slider.control()}>
            <div mix={slider.track()}>
              <div mix={slider.indicator()} />
            </div>
            {Array.from({ length: count }, (_, index) => (
              <span
                style={thumbStyle}
                aria-label={props.labelled ? undefined : `Thumb ${index + 1}`}
                mix={slider.thumb({ index })}
              />
            ))}
          </div>
        </div>
      </slider.Context>
    )
  }
}

describe('slider', () => {
  it('renders slider semantics, state attributes, and positions', (t) => {
    let { $, $$, cleanup } = render(<Basic defaultValue={25} labelled />)
    t.after(cleanup)

    let root = $('[role="group"]') as HTMLElement
    let thumb = $('[role="slider"]') as HTMLElement
    let label = $('span') as HTMLElement
    let output = $('output') as HTMLElement
    let indicator = $$('div')[3] as HTMLElement

    expect(root.getAttribute('data-orientation')).toBe('horizontal')
    expect(root.getAttribute('aria-labelledby')).toBe(label.id)
    expect(thumb.tabIndex).toBe(0)
    expect(thumb.getAttribute('aria-valuenow')).toBe('25')
    expect(thumb.getAttribute('aria-valuemin')).toBe('0')
    expect(thumb.getAttribute('aria-valuemax')).toBe('100')
    expect(thumb.getAttribute('aria-orientation')).toBe('horizontal')
    expect(thumb.getAttribute('aria-labelledby')).toBe(label.id)
    expect(thumb.hasAttribute('aria-valuetext')).toBe(false)
    expect(thumb.getAttribute('data-index')).toBe('0')
    expect(thumb.style.insetInlineStart).toBe('25%')
    expect(thumb.style.position).toBe('absolute')
    expect(indicator.style.width).toBe('25%')
    expect(indicator.style.insetInlineStart).toBe('0%')
    expect(output.textContent).toBe('25')
    expect(output.getAttribute('for')).toBe(thumb.id)
    expect(output.getAttribute('aria-live')).toBe('off')
  })

  it('steps with the keyboard: arrows, Shift, PageUp/PageDown, Home/End', async (t) => {
    let changes: Array<[number | number[], string]> = []
    let commits: Array<number | number[]> = []
    let { $, act, cleanup } = render(
      <Basic
        defaultValue={50}
        onValueChange={(value, details) => void changes.push([value, details.reason])}
        onValueCommitted={(value) => void commits.push(value)}
      />,
    )
    t.after(cleanup)
    let thumb = $('[role="slider"]') as HTMLElement

    let event: KeyboardEvent | undefined
    await act(() => {
      event = key(thumb, 'ArrowRight')
    })
    expect(event!.defaultPrevented).toBe(true)
    expect(thumb.getAttribute('aria-valuenow')).toBe('51')
    await act(() => key(thumb, 'ArrowUp'))
    expect(thumb.getAttribute('aria-valuenow')).toBe('52')
    await act(() => key(thumb, 'ArrowLeft', { shiftKey: true }))
    expect(thumb.getAttribute('aria-valuenow')).toBe('42')
    await act(() => key(thumb, 'PageUp'))
    expect(thumb.getAttribute('aria-valuenow')).toBe('52')
    await act(() => key(thumb, 'PageDown'))
    await act(() => key(thumb, 'ArrowDown'))
    expect(thumb.getAttribute('aria-valuenow')).toBe('41')
    await act(() => key(thumb, 'End'))
    expect(thumb.getAttribute('aria-valuenow')).toBe('100')
    await act(() => key(thumb, 'ArrowRight'))
    expect(thumb.getAttribute('aria-valuenow')).toBe('100')
    await act(() => key(thumb, 'Home'))
    expect(thumb.getAttribute('aria-valuenow')).toBe('0')

    expect(changes.map(([value]) => value)).toEqual([51, 52, 42, 52, 42, 41, 100, 0])
    expect(changes.every(([, reason]) => reason === 'keyboard')).toBe(true)
    expect(commits).toEqual([51, 52, 42, 52, 42, 41, 100, 0])
  })

  it('flips horizontal arrow keys in RTL', async (t) => {
    let { $, act, cleanup } = render(
      <div dir="rtl">
        <Basic defaultValue={50} />
      </div>,
    )
    t.after(cleanup)
    let thumb = $('[role="slider"]') as HTMLElement
    await act(() => key(thumb, 'ArrowLeft'))
    expect(thumb.getAttribute('aria-valuenow')).toBe('51')
    await act(() => key(thumb, 'ArrowRight'))
    await act(() => key(thumb, 'ArrowRight'))
    expect(thumb.getAttribute('aria-valuenow')).toBe('49')
    // The thumb translates toward the inline start in RTL.
    await act(() => Promise.resolve())
    expect(thumb.style.translate).toBe('50% -50%')
  })

  it('snaps to step from min, with decimal steps', async (t) => {
    let { $, act, cleanup } = render(<Basic defaultValue={0.3} min={0} max={1} step={0.1} />)
    t.after(cleanup)
    let thumb = $('[role="slider"]') as HTMLElement
    await act(() => key(thumb, 'ArrowRight'))
    expect(thumb.getAttribute('aria-valuenow')).toBe('0.4')
    await act(() => key(thumb, 'ArrowRight'))
    expect(thumb.getAttribute('aria-valuenow')).toBe('0.5')
  })

  it('moves the thumb on track press and drag, and commits on release', async (t) => {
    let changes: Array<[number | number[], string]> = []
    let commits: Array<[number | number[], string]> = []
    let { $, act, cleanup } = render(
      <Basic
        defaultValue={10}
        onValueChange={(value, details) => void changes.push([value, details.reason])}
        onValueCommitted={(value, details) => void commits.push([value, details.reason])}
      />,
    )
    t.after(cleanup)
    let control = $('[style*="position:fixed"], [style*="position: fixed"]') as HTMLElement
    let thumb = $('[role="slider"]') as HTMLElement
    let root = $('[role="group"]') as HTMLElement

    let down: PointerEvent | undefined
    await act(() => {
      down = pointer(control, 'pointerdown', 100)
    })
    expect(down!.defaultPrevented).toBe(true)
    expect(thumb.getAttribute('aria-valuenow')).toBe('50')
    expect(document.activeElement).toBe(thumb)
    expect(root.hasAttribute('data-dragging')).toBe(false)

    await act(() => pointer(control, 'pointermove', 150))
    expect(thumb.getAttribute('aria-valuenow')).toBe('75')
    expect(root.hasAttribute('data-dragging')).toBe(true)
    expect(thumb.hasAttribute('data-dragging')).toBe(true)

    await act(() => pointer(control, 'pointermove', 500))
    expect(thumb.getAttribute('aria-valuenow')).toBe('100')

    await act(() => pointer(control, 'pointerup', 500))
    expect(root.hasAttribute('data-dragging')).toBe(false)
    expect(changes).toEqual([
      [50, 'track-press'],
      [75, 'drag'],
      [100, 'drag'],
    ])
    expect(commits).toEqual([[100, 'drag']])

    // A press without movement commits as a track press.
    await act(() => pointer(control, 'pointerdown', 20))
    await act(() => pointer(control, 'pointerup', 20))
    expect(commits[1]).toEqual([10, 'track-press'])
  })

  it('keeps the grab offset when dragging from the thumb itself', async (t) => {
    let { $, act, cleanup } = render(<Basic defaultValue={50} />)
    t.after(cleanup)
    let control = $('[style*="fixed"]') as HTMLElement
    let thumb = $('[role="slider"]') as HTMLElement
    let rect = thumb.getBoundingClientRect()
    let center = rect.left + rect.width / 2
    expect(Math.round(center)).toBe(100)

    // Press 4px right of the thumb's center: no jump.
    await act(() => pointer(thumb, 'pointerdown', center + 4))
    expect(thumb.getAttribute('aria-valuenow')).toBe('50')
    await act(() => pointer(control, 'pointermove', center + 24))
    expect(thumb.getAttribute('aria-valuenow')).toBe('60')
    await act(() => pointer(control, 'pointerup', center + 24))
  })

  it('supports range sliders: closest thumb, push collisions, min distance, hidden inputs', async (t) => {
    let changes: Array<number | number[]> = []
    let { $$, act, container, cleanup } = render(
      <form>
        <Basic
          defaultValue={[20, 60]}
          thumbs={2}
          name="price"
          minStepsBetweenValues={10}
          onValueChange={(value) => void changes.push(value)}
        />
      </form>,
    )
    t.after(cleanup)
    let [first, second] = [...$$('[role="slider"]')] as HTMLElement[]
    let control = container.querySelector('[style*="fixed"]') as HTMLElement
    let indicator = container.querySelectorAll('div')[3] as HTMLElement
    let form = container.querySelector('form')!

    expect(first.getAttribute('aria-valuetext')).toBe('20 start range')
    expect(second.getAttribute('aria-valuetext')).toBe('60 end range')
    expect(indicator.style.insetInlineStart).toBe('20%')
    expect(indicator.style.width).toBe('40%')
    expect(container.querySelector('output')!.textContent).toBe('20 – 60')
    expect(new FormData(form).getAll('price')).toEqual(['20', '60'])

    // 140px → 70: closest to the second thumb.
    await act(() => pointer(control, 'pointerdown', 140))
    expect(second.getAttribute('aria-valuenow')).toBe('70')
    expect(document.activeElement).toBe(second)
    // Drag it below the first thumb: pushes it down, keeping 10 apart.
    await act(() => pointer(control, 'pointermove', 20))
    expect(second.getAttribute('aria-valuenow')).toBe('10')
    expect(first.getAttribute('aria-valuenow')).toBe('0')
    await act(() => pointer(control, 'pointerup', 20))
    expect(new FormData(form).getAll('price')).toEqual(['0', '10'])
    expect(changes.at(-1)).toEqual([0, 10])

    // Keyboard can't cross the neighbor (minus the minimum distance).
    await act(() => key(first, 'End'))
    expect(first.getAttribute('aria-valuenow')).toBe('0')
    await act(() => key(second, 'Home'))
    expect(second.getAttribute('aria-valuenow')).toBe('10')
    await act(() => key(second, 'End'))
    expect(second.getAttribute('aria-valuenow')).toBe('100')
    await act(() => key(first, 'End'))
    expect(first.getAttribute('aria-valuenow')).toBe('90')
  })

  it("stops at the neighbor with thumbCollisionBehavior 'none' and swaps with 'swap'", async (t) => {
    let none = render(<Basic defaultValue={[20, 60]} thumbs={2} thumbCollisionBehavior="none" />)
    t.after(none.cleanup)
    let control = none.container.querySelector('[style*="fixed"]') as HTMLElement
    let [a, b] = [...none.$$('[role="slider"]')] as HTMLElement[]
    await none.act(() => pointer(control, 'pointerdown', 40))
    await none.act(() => pointer(control, 'pointermove', 180))
    await none.act(() => pointer(control, 'pointerup', 180))
    expect(a.getAttribute('aria-valuenow')).toBe('60')
    expect(b.getAttribute('aria-valuenow')).toBe('60')
    none.cleanup()

    let swap = render(<Basic defaultValue={[20, 60]} thumbs={2} thumbCollisionBehavior="swap" />)
    t.after(swap.cleanup)
    let control2 = swap.container.querySelector('[style*="fixed"]') as HTMLElement
    let [c, d] = [...swap.$$('[role="slider"]')] as HTMLElement[]
    await swap.act(() => pointer(control2, 'pointerdown', 40))
    await swap.act(() => pointer(control2, 'pointermove', 180))
    expect(c.getAttribute('aria-valuenow')).toBe('60')
    expect(d.getAttribute('aria-valuenow')).toBe('90')
    await swap.act(() => Promise.resolve())
    expect(document.activeElement).toBe(d)
    await swap.act(() => pointer(control2, 'pointermove', 160))
    expect(d.getAttribute('aria-valuenow')).toBe('80')
    await swap.act(() => pointer(control2, 'pointerup', 160))
  })

  it('supports controlled values and cancel()', async (t) => {
    let seen: number[] = []
    function Controlled(handle: Handle) {
      let value = 30
      return () => (
        <div>
          <Basic
            value={value}
            onValueChange={(next, details) => {
              seen.push(next as number)
              if ((next as number) > 40) {
                details.cancel()
                return
              }
              value = next as number
              void handle.update()
            }}
          />
          <button
            id="external"
            mix={on('click', () => {
              value = 5
              void handle.update()
            })}
          />
        </div>
      )
    }
    let { $, act, cleanup } = render(<Controlled />)
    t.after(cleanup)
    let thumb = $('[role="slider"]') as HTMLElement

    await act(() => key(thumb, 'PageUp'))
    expect(thumb.getAttribute('aria-valuenow')).toBe('40')
    await act(() => key(thumb, 'ArrowUp'))
    expect(thumb.getAttribute('aria-valuenow')).toBe('40')
    expect(seen).toEqual([40, 41])
    await act(() => ($('#external') as HTMLElement).click())
    expect(thumb.getAttribute('aria-valuenow')).toBe('5')
  })

  it('ignores a controlled change the owner does not apply', async (t) => {
    let { $, act, cleanup } = render(<Basic value={30} />)
    t.after(cleanup)
    let thumb = $('[role="slider"]') as HTMLElement
    await act(() => key(thumb, 'ArrowUp'))
    expect(thumb.getAttribute('aria-valuenow')).toBe('30')
  })

  it('dispatches bubbling change and commit events', async (t) => {
    let changes: slider.SliderChangeEvent[] = []
    let commits: slider.SliderCommitEvent[] = []
    let { $, act, cleanup } = render(
      <div
        mix={[
          slider.onSliderChange((event) => void changes.push(event)),
          slider.onSliderCommit((event) => void commits.push(event)),
        ]}
      >
        <Basic defaultValue={[10, 20]} thumbs={2} />
      </div>,
    )
    t.after(cleanup)
    let thumb = $('[role="slider"]') as HTMLElement
    await act(() => key(thumb, 'ArrowUp'))
    expect(changes.length).toBe(1)
    expect(changes[0]).toBeInstanceOf(slider.SliderChangeEvent)
    expect(changes[0].value).toEqual([11, 20])
    expect(changes[0].reason).toBe('keyboard')
    expect(changes[0].activeThumbIndex).toBe(0)
    expect(commits[0].value).toEqual([11, 20])
  })

  it('disables the whole slider or a single thumb', async (t) => {
    let changes: unknown[] = []
    let { $, $$, act, container, cleanup } = render(
      <Basic
        defaultValue={50}
        disabled
        name="volume"
        onValueChange={(value) => void changes.push(value)}
      />,
    )
    t.after(cleanup)
    let thumb = $('[role="slider"]') as HTMLElement
    let control = container.querySelector('[style*="fixed"]') as HTMLElement
    expect(thumb.tabIndex).toBe(-1)
    expect(thumb.getAttribute('aria-disabled')).toBe('true')
    expect($('[role="group"]')!.hasAttribute('data-disabled')).toBe(true)
    expect((container.querySelector('input[type="hidden"]') as HTMLInputElement).disabled).toBe(
      true,
    )
    await act(() => key(thumb, 'ArrowUp'))
    await act(() => pointer(control, 'pointerdown', 10))
    expect(changes).toEqual([])
    expect($$('[role="slider"]').length).toBe(1)

    function PerThumb() {
      return () => (
        <slider.Context defaultValue={[10, 90]}>
          <div style={controlStyle} mix={slider.control()}>
            <span aria-label="a" mix={slider.thumb({ index: 0, disabled: true })} />
            <span aria-label="b" mix={slider.thumb({ index: 1 })} />
          </div>
        </slider.Context>
      )
    }
    let second = render(<PerThumb />)
    t.after(second.cleanup)
    let [a, b] = [...second.$$('[role="slider"]')] as HTMLElement[]
    expect(a.getAttribute('aria-disabled')).toBe('true')
    expect(a.hasAttribute('data-disabled')).toBe(true)
    expect(b.hasAttribute('aria-disabled')).toBe(false)
    await second.act(() => key(a, 'ArrowUp'))
    expect(a.getAttribute('aria-valuenow')).toBe('10')
  })

  it('supports vertical orientation', async (t) => {
    let { $, act, container, cleanup } = render(
      <slider.Context defaultValue={50} orientation="vertical">
        <div style="position:fixed;left:0;top:0;width:20px;height:200px" mix={slider.control()}>
          <div mix={slider.track()}>
            <div mix={slider.indicator()} />
          </div>
          <span aria-label="Level" mix={slider.thumb()} />
        </div>
      </slider.Context>,
    )
    t.after(cleanup)
    let thumb = $('[role="slider"]') as HTMLElement
    let control = container.firstElementChild as HTMLElement
    let indicator = container.querySelectorAll('div')[2] as HTMLElement
    expect(thumb.getAttribute('aria-orientation')).toBe('vertical')
    expect(thumb.getAttribute('data-orientation')).toBe('vertical')
    expect(thumb.style.bottom).toBe('50%')
    expect(indicator.style.height).toBe('50%')
    expect(indicator.style.bottom).toBe('0%')

    // y = 50 → 75% from the bottom.
    await act(() => pointer(control, 'pointerdown', 10, 50))
    expect(thumb.getAttribute('aria-valuenow')).toBe('75')
    await act(() => pointer(control, 'pointerup', 10, 50))
    await act(() => key(thumb, 'ArrowRight'))
    expect(thumb.getAttribute('aria-valuenow')).toBe('76')
  })

  it('edge alignment keeps the thumb inside the control and maps pointers accordingly', async (t) => {
    let { $, act, container, cleanup } = render(
      <slider.Context defaultValue={0} thumbAlignment="edge">
        <div style="position:fixed;left:0;top:0;width:220px;height:20px" mix={slider.control()}>
          <span style="width:20px;height:20px;display:block" aria-label="x" mix={slider.thumb()} />
        </div>
      </slider.Context>,
    )
    t.after(cleanup)
    let thumb = $('[role="slider"]') as HTMLElement
    let control = container.firstElementChild as HTMLElement
    expect(thumb.style.translate).toBe('0% -50%')
    expect(Math.round(thumb.getBoundingClientRect().left)).toBe(0)

    // The usable range is 10px..210px: x = 110 is the middle.
    await act(() => pointer(control, 'pointerdown', 110))
    expect(thumb.getAttribute('aria-valuenow')).toBe('50')
    expect(thumb.style.translate).toBe('-50% -50%')
    await act(() => pointer(control, 'pointerup', 110))
    await act(() => key(thumb, 'End'))
    expect(Math.round(thumb.getBoundingClientRect().right)).toBe(220)
  })

  it('formats values and supports getAriaValueText / getAriaLabel', (t) => {
    let { $, cleanup } = render(
      <slider.Context
        defaultValue={0.25}
        min={0}
        max={1}
        step={0.01}
        format={{ style: 'percent' }}
        locale="en-US"
      >
        <output mix={slider.value()}>
          <slider.ValueText>
            {(formatted, values) => `${formatted[0]} (${values[0]})`}
          </slider.ValueText>
        </output>
        <span
          mix={slider.thumb({
            getAriaLabel: (index) => `Opacity ${index}`,
            getAriaValueText: (formatted) => `${formatted} opaque`,
          })}
        />
      </slider.Context>,
    )
    t.after(cleanup)
    let thumb = $('[role="slider"]') as HTMLElement
    expect(thumb.getAttribute('aria-label')).toBe('Opacity 0')
    expect(thumb.getAttribute('aria-valuetext')).toBe('25% opaque')
    expect($('output')!.textContent).toBe('25% (0.25)')
  })

  it('focuses the first thumb when the label is clicked', async (t) => {
    let { $, act, cleanup } = render(<Basic defaultValue={10} labelled />)
    t.after(cleanup)
    await act(() => ($('span') as HTMLElement).click())
    expect(document.activeElement).toBe($('[role="slider"]'))
  })

  it('accepts every mixin called with no arguments', (t) => {
    let { $$, cleanup } = render(
      <slider.Context>
        <div mix={slider.root()}>
          <span mix={slider.label()} />
          <output mix={slider.value()} />
          <div mix={slider.control()}>
            <div mix={slider.track()}>
              <div mix={slider.indicator()} />
            </div>
            <span mix={slider.thumb()} />
          </div>
        </div>
      </slider.Context>,
    )
    t.after(cleanup)
    let thumb = $$('[role="slider"]')[0] as HTMLElement
    expect(thumb.getAttribute('aria-valuenow')).toBe('0')
  })
})

function submitForm(formNode: Element) {
  formNode.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
}

function FieldSlider(handle: Handle<slider.SliderContextProps>) {
  return () => (
    <slider.Context {...handle.props}>
      <div id="s-root" mix={slider.root()}>
        <div style={controlStyle} mix={slider.control()}>
          <div id="s-track" mix={slider.track()}>
            <div mix={slider.indicator()} />
          </div>
          {(Array.isArray(handle.props.defaultValue) ? handle.props.defaultValue : [0]).map(
            (_, index) => (
              <span style={thumbStyle} mix={slider.thumb({ index })} />
            ),
          )}
        </div>
      </div>
    </slider.Context>
  )
}

describe('slider in a field', () => {
  it('is labelled, described and named by the field', async (t) => {
    let { $, $$, act, container, cleanup } = render(
      <field.Context name="volume">
        <div id="label" mix={field.label()}>
          Volume
        </div>
        <FieldSlider name="ignored" defaultValue={[20, 60]} />
        <p id="description" mix={field.description()}>
          Loudness
        </p>
      </field.Context>,
    )
    t.after(cleanup)
    await act(() => {})
    let thumbs = [...$$('[role=slider]')] as HTMLElement[]
    for (let thumb of thumbs) {
      expect(thumb.getAttribute('aria-labelledby')).toBe('label')
      expect(thumb.getAttribute('aria-describedby')).toBe('description')
    }
    expect($('#s-root')!.getAttribute('aria-labelledby')).toBe('label')
    let hidden = [...container.querySelectorAll('input[type=hidden]')] as HTMLInputElement[]
    expect(hidden.map((input) => `${input.name}=${input.value}`)).toEqual([
      'volume=20',
      'volume=60',
    ])
    // A non-<label> field label focuses the first thumb.
    await act(() => ($('#label') as HTMLElement).click())
    expect(document.activeElement).toBe(thumbs[0])
    expect($('#s-root')!.hasAttribute('data-focused')).toBe(true)
    expect($('#s-track')!.hasAttribute('data-focused')).toBe(true)
    await act(() => key(thumbs[0]!, 'ArrowRight'))
    expect(thumbs[0]!.hasAttribute('data-dirty')).toBe(true)
    // Moving between thumbs doesn't blur the field.
    await act(() => thumbs[1]!.focus())
    expect(thumbs[1]!.hasAttribute('data-touched')).toBe(false)
    expect(thumbs[1]!.hasAttribute('data-filled')).toBe(false)
  })

  it('validates the value with the field and blocks submission', async (t) => {
    let submitted: form.FormValues[] = []
    let { $, act, cleanup } = render(
      <form.Context onFormSubmit={(values) => void submitted.push(values)}>
        <form mix={form.root()}>
          <field.Context
            name="volume"
            validate={(value) => ((value as number) < 10 ? 'Too quiet' : null)}
          >
            <FieldSlider defaultValue={5} />
            <div id="error" mix={field.error()}>
              <field.Validity>{(state) => state.error}</field.Validity>
            </div>
          </field.Context>
        </form>
      </form.Context>,
    )
    t.after(cleanup)
    let thumb = $('[role=slider]') as HTMLElement
    await act(() => submitForm($('form')!))
    expect(submitted).toEqual([])
    expect(document.activeElement).toBe(thumb)
    expect(thumb.getAttribute('aria-invalid')).toBe('true')
    expect(thumb.getAttribute('aria-describedby')).toBe('error')
    expect($('#error')!.textContent).toBe('Too quiet')
    await act(() => key(thumb, 'PageUp'))
    expect(thumb.hasAttribute('data-valid')).toBe(true)
    await act(() => submitForm($('form')!))
    expect(submitted).toEqual([{ volume: 15 }])
  })

  it('clears server errors on change', async (t) => {
    let { $, act, cleanup } = render(
      <form.Context errors={{ volume: 'Too loud' }}>
        <field.Context name="volume">
          <FieldSlider defaultValue={50} />
        </field.Context>
      </form.Context>,
    )
    t.after(cleanup)
    let thumb = $('[role=slider]') as HTMLElement
    expect(thumb.getAttribute('aria-invalid')).toBe('true')
    expect($('#s-root')!.hasAttribute('data-invalid')).toBe(true)
    await act(() => key(thumb, 'ArrowLeft'))
    expect(thumb.hasAttribute('aria-invalid')).toBe(false)
  })

  it('is disabled by the field or an enclosing fieldset', async (t) => {
    let { $$, act, cleanup } = render(
      <div>
        <field.Context disabled>
          <FieldSlider defaultValue={50} />
        </field.Context>
        <fieldset.Context disabled>
          <FieldSlider defaultValue={50} />
        </fieldset.Context>
      </div>,
    )
    t.after(cleanup)
    let thumbs = [...$$('[role=slider]')] as HTMLElement[]
    for (let thumb of thumbs) {
      expect(thumb.getAttribute('aria-disabled')).toBe('true')
      expect(thumb.hasAttribute('data-disabled')).toBe(true)
    }
    await act(() => key(thumbs[0]!, 'ArrowRight'))
    expect(thumbs[0]!.getAttribute('aria-valuenow')).toBe('50')
  })
})

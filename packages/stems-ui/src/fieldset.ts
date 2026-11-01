import { attrs, createMixin } from '@remix-run/component'
import type {
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

/** Props for `<fieldset.Context>`. */
export interface FieldsetContextProps {
  children?: RemixNode
  /**
   * Whether the fieldset and every field inside it should ignore user interaction. Sets the native
   * `disabled` attribute on a `<fieldset>` root and propagates to `stems-ui/field` (and every
   * control that integrates with it) through context. Nested fieldsets inherit it.
   * @default false
   */
  disabled?: boolean
}

/** State provided by `<fieldset.Context>`, readable with `handle.context.get(fieldset.Context)`. */
export interface FieldsetContextValue {
  /** Whether this fieldset, or an enclosing one, is disabled. */
  readonly disabled: boolean
  /** The id of the rendered `fieldset.legend()`, if any. */
  readonly legendId: string | undefined
}

interface LegendEntry {
  id: string
  native: boolean
}

interface FieldsetInternals {
  readonly defaultLegendId: string
  readonly legend: LegendEntry | undefined
  registerLegend(entry: LegendEntry, handle: MixinHandle<HTMLElement>): () => void
  legendChanged(handle: MixinHandle<HTMLElement>): void
}

const internalsByContext = new WeakMap<FieldsetContextValue, FieldsetInternals>()

function FieldsetProvider(
  handle: Handle<FieldsetContextProps, FieldsetContextValue>,
): () => RemixNode {
  let parent = handle.context.get(FieldsetProvider) as FieldsetContextValue | undefined
  let legends: LegendEntry[] = []
  let pending = false

  // Called from part render paths, so the provider re-renders after the current commit.
  function scheduleUpdate(from: MixinHandle<HTMLElement>) {
    if (pending || typeof document === 'undefined') return
    pending = true
    from.queueTask(() => {
      pending = false
      if (!handle.signal.aborted) void handle.update()
    })
  }

  let context: FieldsetContextValue = {
    get disabled() {
      return handle.props.disabled === true || parent?.disabled === true
    },
    get legendId() {
      return legends[0]?.id
    },
  }

  internalsByContext.set(context, {
    defaultLegendId: `${handle.id}-legend`,
    get legend() {
      return legends[0]
    },
    registerLegend(entry, from) {
      legends.push(entry)
      scheduleUpdate(from)
      return () => {
        legends = legends.filter((item) => item !== entry)
        scheduleUpdate(from)
      }
    },
    legendChanged: scheduleUpdate,
  })

  handle.context.set(context)
  return () => handle.props.children
}

function getFieldset(handle: MixinHandle<HTMLElement, ElementProps>, part: string) {
  let context = handle.context.get(FieldsetProvider) as FieldsetContextValue | undefined
  if (!context) {
    throw new Error(`fieldset.${part}() must be rendered inside <fieldset.Context>`)
  }
  return [context, internalsByContext.get(context)!] as const
}

const rootMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle, hostType) => {
  let [context, internals] = getFieldset(handle, 'root')
  let isFieldset = hostType === 'fieldset'

  return (props) => {
    let disabled = context.disabled
    let legend = internals.legend
    // A native <legend> child names a native <fieldset>; anything else needs aria-labelledby.
    let labelledBy = legend && !(isFieldset && legend.native) ? legend.id : undefined
    let hasName = props['aria-label'] !== undefined

    return attrs({
      role: isFieldset ? undefined : 'group',
      disabled: isFieldset && disabled ? true : undefined,
      'aria-disabled': !isFieldset && disabled ? 'true' : undefined,
      'aria-labelledby': hasName ? undefined : labelledBy,
      'data-disabled': disabled ? '' : undefined,
    })
  }
})

const legendMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle, hostType) => {
  let [context, internals] = getFieldset(handle, 'legend')
  let entry: LegendEntry = { id: internals.defaultLegendId, native: hostType === 'legend' }
  let unregister = internals.registerLegend(entry, handle)
  handle.signal.addEventListener('abort', unregister)

  return (props) => {
    let id = typeof props.id === 'string' ? props.id : internals.defaultLegendId
    if (id !== entry.id) {
      entry.id = id
      internals.legendChanged(handle)
    }

    return attrs({
      id: internals.defaultLegendId,
      'data-disabled': context.disabled ? '' : undefined,
    })
  }
})

/**
 * Provider that owns the fieldset's `disabled` state and shares it with the fields inside.
 * Base UI's `Fieldset.Root` props live here.
 */
export const Context = FieldsetProvider

/**
 * Wires the fieldset root. Use a native `<fieldset>` (gets `disabled`). Any other host gets
 * `role="group"` and `aria-disabled`. The root is named by `fieldset.legend()` through
 * `aria-labelledby` unless the legend is a native `<legend>` inside a native `<fieldset>`.
 */
export const root = rootMixin

/**
 * Wires the legend: an `id` for the root's `aria-labelledby` and `data-disabled`. Use a native
 * `<legend>` (first child of a `<fieldset>`) or any element, such as a `<div>` like Base UI.
 */
export const legend = legendMixin

import { attrs, createMixin } from '@remix-run/component'
import type { ElementProps, MixinFactory, MixinHandle } from '@remix-run/component'

import { createPresence } from './presence.ts'

export interface CollapsiblePanelOptions {
  /**
   * Hide the closed panel with `hidden="until-found"` so find-in-page can reveal (and open) it.
   */
  hiddenUntilFound?: boolean
  /**
   * Accepted for Base UI parity. Stems panels are always kept mounted: the panel element is
   * app-owned markup, so a closed panel stays in the DOM with `hidden`.
   */
  keepMounted?: boolean
}

/** Live panel state, read from the owning widget's context on every render. */
export interface CollapsiblePanelState {
  readonly open: boolean
  readonly panelId: string
  /** Default for `hiddenUntilFound` when the panel options don't set it. */
  readonly hiddenUntilFound: boolean
  /** Opens the panel after the browser revealed its `hidden="until-found"` content. */
  revealFromMatch(event: Event): void
  /** Re-renders the widget (the owning Context provider) so the panel renders fresh props. */
  update(): Promise<unknown>
  /** Extra widget-specific default attributes (role, labelling, indexes, ...). */
  attrs?(): ElementProps
}

export interface CollapsiblePanelConfig {
  /** CSS variable prefix: `'collapsible'` → `--collapsible-panel-height` / `-width`. */
  cssVarPrefix: string
  getState(handle: MixinHandle<HTMLElement>): CollapsiblePanelState
}

/**
 * Builds the panel mixin shared by `collapsible.panel()` and `accordion.panel()`.
 *
 * - `id`, `data-open` / `data-closed`, and `hidden` (or `hidden="until-found"`) for closed panels,
 *   all correct in server HTML.
 * - `data-starting-style` / `data-ending-style` through `lib/presence.ts`; closed panels stay
 *   visible until their exit animation finishes.
 * - `--<prefix>-panel-height` / `--<prefix>-panel-width`: measured in px while animating, `auto`
 *   once open, so CSS can transition `height: var(--<prefix>-panel-height)`.
 * - `beforematch` (find-in-page on a `hidden="until-found"` panel) opens the panel instantly.
 */
export function createCollapsiblePanelMixin(
  config: CollapsiblePanelConfig,
): MixinFactory<HTMLElement, [options?: CollapsiblePanelOptions], ElementProps> {
  let heightVar = `--${config.cssVarPrefix}-panel-height`
  let widthVar = `--${config.cssVarPrefix}-panel-width`

  function setSize(node: HTMLElement, height: string, width: string) {
    node.style.setProperty(heightVar, height)
    node.style.setProperty(widthVar, width)
  }

  function measure(node: HTMLElement) {
    setSize(node, `${node.scrollHeight}px`, `${node.scrollWidth}px`)
  }

  return createMixin<HTMLElement, [options?: CollapsiblePanelOptions], ElementProps>((handle) => {
    let state = config.getState(handle)
    let node: HTMLElement | null = null
    let hiddenUntilFound = false

    let presence = createPresence(handle, {
      update: () => state.update(),
      onBeforeEnter: measure,
      onAfterEnter(node) {
        setSize(node, 'auto', 'auto')
      },
      onBeforeExit(node) {
        measure(node)
        // Commit the px size so the exit animates from it rather than from `auto`.
        void node.offsetHeight
      },
      onAfterExit(node) {
        // `hidden="until-found"` hides content with `content-visibility` rather than
        // `display: none`, so the box keeps whatever height CSS gives it. Collapse the size
        // variables so `height: var(--…-panel-height)` styles don't leave an empty gap.
        setSize(node, '0px', '0px')
      },
    })

    function onBeforeMatch(event: Event) {
      presence.skipTransition()
      if (node) setSize(node, 'auto', 'auto')
      state.revealFromMatch(event)
      // A controlled owner may keep the panel closed: put `until-found` back in that case.
      void state.update().then(() => {
        if (node && !state.open && hiddenUntilFound) {
          node.setAttribute('hidden', 'until-found')
        }
      })
    }

    handle.addEventListener('insert', (event) => {
      node = event.node
      if (state.open) setSize(node, 'auto', 'auto')
      node.addEventListener('beforematch', onBeforeMatch)
    })

    handle.addEventListener('remove', () => {
      node?.removeEventListener('beforematch', onBeforeMatch)
      node = null
    })

    return (options, props) => {
      ;[options] = splitOptions(options, props)
      let open = state.open
      presence.sync(open)
      hiddenUntilFound = options?.hiddenUntilFound ?? state.hiddenUntilFound

      return attrs({
        ...state.attrs?.(),
        id: state.panelId,
        hidden: presence.present ? undefined : hiddenUntilFound ? 'until-found' : true,
        'data-open': open ? '' : undefined,
        'data-closed': open ? undefined : '',
        ...presence.attrs(),
      })
    }
  })
}

/**
 * Normalizes a mixin render call made with optional options: when the factory was called
 * without arguments, the runtime passes the host props in the options position.
 */
export function splitOptions<options extends object>(
  options: options | undefined,
  props: ElementProps | undefined,
): [options: options | undefined, props: ElementProps] {
  if (props === undefined) {
    return [undefined, (options ?? {}) as ElementProps]
  }
  return [options, props]
}

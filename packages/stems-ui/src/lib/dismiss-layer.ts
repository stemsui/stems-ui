/**
 * A per-document stack of dismissable layers (popovers, menus, dialogs, tooltips, …).
 *
 * Every open popup registers a layer. One set of capture-phase document listeners decides which
 * layer an Escape key or an outside press belongs to, so nested popups behave correctly:
 *
 * - **Escape** dismisses only the topmost layer that accepts Escape, and stops the event, so a
 *   popover inside a dialog closes without closing the dialog.
 * - **Outside press** walks the stack from the top. A press inside a layer (or anything that layer
 *   claims via `contains`) stops the walk; each layer above it that the press was outside of is
 *   dismissed. So pressing inside a parent closes its children, and pressing outside everything
 *   closes the whole tree.
 *
 * Layers are ordered by registration, so register a layer when its popup opens and unregister it
 * when it closes.
 */

export type DismissReason = 'escape-key' | 'outside-press'

export interface DismissLayerOptions {
  /** The popup element. Presses inside it are never "outside". */
  node: HTMLElement
  /** Called when the layer should close. The layer stays registered until you unregister it. */
  onDismiss(reason: DismissReason, event: Event): void
  /**
   * Extra hit test for presses that should count as inside, e.g. the trigger (so pressing the
   * trigger toggles instead of dismiss-then-reopen) or a native `<dialog>`'s backdrop handling.
   * Return `true` for inside, `false` for outside, or `undefined` to use the default test.
   */
  contains?(target: Node, event: Event): boolean | undefined
  /** Whether Escape dismisses this layer. Default `true`. */
  dismissOnEscape?: boolean
  /**
   * Whether outside presses dismiss this layer. Default `true`. A layer that ignores outside
   * presses (e.g. a modal alert dialog) still stops the walk, so layers below it stay open.
   */
  dismissOnOutsidePress?: boolean
}

interface Layer extends DismissLayerOptions {
  id: number
}

interface DocumentLayers {
  layers: Layer[]
  pressTarget: Node | null
  cleanup(): void
}

const stacks = new WeakMap<Document, DocumentLayers>()
let nextId = 1

export function registerDismissLayer(options: DismissLayerOptions): () => void {
  let doc = options.node.ownerDocument
  let stack = stacks.get(doc) ?? installListeners(doc)
  let layer: Layer = { ...options, id: nextId++ }
  stack.layers.push(layer)

  let unregistered = false
  return () => {
    if (unregistered) return
    unregistered = true
    let index = stack.layers.indexOf(layer)
    if (index !== -1) stack.layers.splice(index, 1)
    if (stack.layers.length === 0) {
      stack.cleanup()
      stacks.delete(doc)
    }
  }
}

/** Whether `node`'s layer is the topmost registered layer in its document. */
export function isTopDismissLayer(node: HTMLElement): boolean {
  let layers = stacks.get(node.ownerDocument)?.layers
  return layers !== undefined && layers.at(-1)?.node === node
}

function installListeners(doc: Document): DocumentLayers {
  let controller = new AbortController()
  let stack: DocumentLayers = {
    layers: [],
    pressTarget: null,
    cleanup: () => controller.abort(),
  }
  let { signal } = controller

  doc.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return
      let layer = liveLayers(stack)
        .reverse()
        .find((candidate) => candidate.dismissOnEscape !== false)
      if (!layer) return
      // Stop the event so outer layers (and native <dialog> close requests) don't also react.
      event.preventDefault()
      event.stopPropagation()
      layer.onDismiss('escape-key', event)
    },
    { capture: true, signal },
  )

  // Track where the press started so a drag that ends outside (e.g. text selection) isn't
  // treated as an outside press.
  doc.addEventListener(
    'pointerdown',
    (event) => {
      stack.pressTarget = event.target instanceof Node ? event.target : null
    },
    { capture: true, signal },
  )

  doc.addEventListener(
    'click',
    (event) => {
      let target = stack.pressTarget ?? (event.target instanceof Node ? event.target : null)
      stack.pressTarget = null
      if (!target) return

      for (let layer of liveLayers(stack).reverse()) {
        if (isInside(layer, target, event)) break
        if (layer.dismissOnOutsidePress === false) break
        layer.onDismiss('outside-press', event)
      }
    },
    { capture: true, signal },
  )

  stacks.set(doc, stack)
  return stack
}

function liveLayers(stack: DocumentLayers): Layer[] {
  return stack.layers.filter((layer) => layer.node.isConnected)
}

function isInside(layer: Layer, target: Node, event: Event): boolean {
  let custom = layer.contains?.(target, event)
  if (custom !== undefined) return custom
  return layer.node.contains(target)
}

import { attrs, createMixin, on, ref } from '@remix-run/component'
import type {
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

export type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface AvatarContextProps {
  children?: RemixNode
}

export interface AvatarContextValue {
  /** The loading status of the avatar's image. */
  readonly imageLoadingStatus: ImageLoadingStatus
  /** Reports a status change from `image()`. */
  setImageLoadingStatus(status: ImageLoadingStatus): void
  /** Re-renders the avatar's parts with their current props. */
  update(): void
}

export interface AvatarImageOptions {
  /** Called when the image loading status changes. */
  onLoadingStatusChange?: (status: ImageLoadingStatus) => void
  /**
   * Keep the image visible while it loads in place, instead of hiding it until a preload
   * finishes. Supports `loading="lazy"`; style the pending state with `data-loading`/`data-error`.
   * @default false
   */
  keepMounted?: boolean
}

export interface AvatarFallbackOptions {
  /**
   * How long to wait before showing the fallback, in milliseconds.
   * @default 0
   */
  delay?: number
}

function readArgs<options>(args: readonly unknown[]): [options, ElementProps] {
  return args.length > 1
    ? [(args[0] ?? {}) as options, args[1] as ElementProps]
    : [{} as options, (args[0] ?? {}) as ElementProps]
}

// Used when `image()`/`fallback()` render outside `avatar.Context`: the image still tracks its own
// status, and the fallback stays visible.
// Mixins re-render through the provider rather than their own `handle.update()`, which would
// re-render with the host props from the last full render.
function getAvatarContext(handle: MixinHandle): AvatarContextValue | undefined {
  return handle.context.get(AvatarProvider)
}

function AvatarProvider(handle: Handle<AvatarContextProps, AvatarContextValue>): () => RemixNode {
  let imageLoadingStatus: ImageLoadingStatus = 'idle'

  handle.context.set({
    get imageLoadingStatus() {
      return imageLoadingStatus
    },
    setImageLoadingStatus(status) {
      if (status === imageLoadingStatus) return
      imageLoadingStatus = status
      void handle.update()
    },
    update() {
      void handle.update()
    },
  })

  return () => handle.props.children
}

const rootMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>(() => {
  // Base UI's Root has no ARIA or data attributes. It exists so markup mirrors Base UI's anatomy.
  return () => attrs({})
})

const imageMixin: MixinFactory<HTMLImageElement, [options?: AvatarImageOptions], ElementProps> =
  createMixin<HTMLImageElement, [options?: AvatarImageOptions], ElementProps>((handle) => {
    let context = getAvatarContext(handle)
    let status: ImageLoadingStatus = 'idle'
    let currentSrc: string | undefined
    let initialized = false
    let node: HTMLImageElement | null = null
    let preload: AbortController | null = null
    let onLoadingStatusChange: AvatarImageOptions['onLoadingStatusChange']
    let keepMounted = false

    function getAttrs() {
      let loaded = status === 'loaded'
      return {
        hidden: keepMounted || loaded ? undefined : true,
        // Hide pending images from assistive technology so the fallback names the avatar.
        'aria-hidden': loaded ? undefined : 'true',
        'data-loading': status === 'loading' ? '' : undefined,
        'data-error': status === 'error' ? '' : undefined,
      } as const
    }

    function setStatus(next: ImageLoadingStatus) {
      if (next === status) return
      status = next
      onLoadingStatusChange?.(next)
      if (context) {
        context.setImageLoadingStatus(next)
        context.update()
      } else if (node) {
        // Without a Context, patch the node directly.
        let attributes = getAttrs()
        node.hidden = attributes.hidden === true
        if (attributes['aria-hidden']) node.setAttribute('aria-hidden', 'true')
        else node.removeAttribute('aria-hidden')
        node.toggleAttribute('data-loading', attributes['data-loading'] === '')
        node.toggleAttribute('data-error', attributes['data-error'] === '')
      }
    }

    // Starts tracking `src`. Runs after commit, so it never runs on the server.
    function track(src: string | undefined) {
      preload?.abort()
      preload = null
      context?.setImageLoadingStatus(status)
      if (!src) return
      // `status` was set to 'loading' during render; report it.
      onLoadingStatusChange?.('loading')

      if (keepMounted) {
        // The element loads in place. Catch images that finished before hydration.
        if (node?.complete && node.currentSrc) {
          setStatus(node.naturalWidth > 0 ? 'loaded' : 'error')
        }
        return
      }

      let controller = new AbortController()
      preload = controller
      let image = new Image()
      image.onload = () => {
        if (!controller.signal.aborted) setStatus('loaded')
      }
      image.onerror = () => {
        if (!controller.signal.aborted) setStatus('error')
      }
      image.src = src
    }

    handle.signal.addEventListener('abort', () => preload?.abort())

    return (...args) => {
      let [options, props] = readArgs<AvatarImageOptions>(args)
      onLoadingStatusChange = options.onLoadingStatusChange
      keepMounted = options.keepMounted === true
      let src = typeof props.src === 'string' && props.src !== '' ? props.src : undefined

      if (!initialized || src !== currentSrc) {
        initialized = true
        currentSrc = src
        status = src ? 'loading' : 'idle'
        handle.queueTask(() => track(src))
      }

      return [
        attrs(getAttrs()),
        ref((element: HTMLImageElement, signal) => {
          node = element
          signal.addEventListener('abort', () => {
            if (node === element) node = null
          })
        }),
        on('load', () => {
          if (keepMounted && currentSrc) setStatus('loaded')
        }),
        on('error', () => {
          if (keepMounted && currentSrc) setStatus('error')
        }),
      ]
    }
  })

const fallbackMixin: MixinFactory<HTMLElement, [options?: AvatarFallbackOptions], ElementProps> =
  createMixin<HTMLElement, [options?: AvatarFallbackOptions], ElementProps>((handle) => {
    let context = getAvatarContext(handle)
    let delayPassed: boolean | undefined

    return (...args) => {
      let [options] = readArgs<AvatarFallbackOptions>(args)
      let delay = options.delay ?? 0

      if (delayPassed === undefined) {
        delayPassed = delay <= 0
        if (!delayPassed) {
          handle.queueTask((node, signal) => {
            let timer = setTimeout(() => {
              delayPassed = true
              if (context) context.update()
              else node.hidden = false
            }, delay)
            signal.addEventListener('abort', () => clearTimeout(timer))
          })
        }
      }

      let visible = delayPassed && context?.imageLoadingStatus !== 'loaded'

      return attrs({ hidden: visible ? undefined : true })
    }
  })

/** Provides the image loading status to `image()` and `fallback()`. */
export const Context = AvatarProvider
/** The avatar's root element (no attributes; mirrors Base UI's anatomy). */
export const root = rootMixin
/** The avatar image. Hidden until its `src` has loaded. */
export const image = imageMixin
/** Content shown while the image is missing, loading, or broken. */
export const fallback = fallbackMixin

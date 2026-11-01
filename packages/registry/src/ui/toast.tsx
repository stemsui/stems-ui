import { on, type Handle, type Props, type RemixNode } from 'remix/component'
import * as toastPrimitive from 'stems-ui/toast'

import { cn } from '#stems/lib/utils.ts'

/*
 * Styled after shadcn/ui's Sonner toaster (base-vega): stacked cards in a corner that fan out on
 * hover or focus, swipe to dismiss. Behavior: stems-ui/toast. The `toast()` helper mirrors
 * Sonner's common API on top of a module-level toast manager.
 *
 * State hooks used for styling (set by stems-ui/toast):
 *   viewport: data-expanded, --toast-frontmost-height
 *   toast: data-type, data-expanded, data-limited, data-swiping, data-swipe-direction,
 *          data-starting-style, data-ending-style,
 *          --toast-index, --toast-offset-y, --toast-height, --toast-swipe-movement-x/y
 *   content: data-behind, data-expanded
 */

export type ToasterPosition =
  'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface ToastButton {
  label: RemixNode
  /** Runs on click. The toast closes afterwards unless the event's default is prevented. */
  onClick?: (event: MouseEvent) => void
}

/** Options for `toast()` and its variants, like Sonner's `ExternalToast`. */
export interface ToastOptions {
  /** Reuse an id to update an existing toast in place. */
  id?: string
  description?: RemixNode
  /** Time in ms before the toast closes. `Infinity` or `0` keeps it open. */
  duration?: number
  /** An action button, e.g. `{ label: 'Undo', onClick }`. */
  action?: ToastButton
  /** A secondary button that closes the toast. */
  cancel?: ToastButton
  /** Replaces the type icon. Pass `null` to hide it. */
  icon?: RemixNode
  /** Shows a close button on this toast (overrides `<Toaster closeButton>`). */
  closeButton?: boolean
  /** Announce the toast assertively (`priority: 'high'`). */
  important?: boolean
  /** Called when the toast starts closing (timeout, swipe, close button, or `dismiss`). */
  onDismiss?: () => void
}

export interface ToastData {
  icon?: RemixNode
  cancel?: ToastButton
  closeButton?: boolean
}

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading'

/** The manager behind `toast()`. `<Toaster>` renders it unless given another `toastManager`. */
export const toastManager: toastPrimitive.ToastManager<ToastData> =
  toastPrimitive.createToastManager<ToastData>()

function toAddOptions(
  type: ToastType | undefined,
  message: RemixNode,
  options: ToastOptions = {},
): toastPrimitive.ToastAddOptions<ToastData> {
  let { id, description, duration, action, cancel, icon, closeButton, important, onDismiss } =
    options
  let toastId = id
  let timeout = duration === Infinity ? 0 : duration
  if (type === 'loading' && timeout === undefined) timeout = 0

  return {
    id,
    title: message,
    description,
    type,
    timeout,
    priority: important ? 'high' : 'low',
    onClose: onDismiss,
    actionProps: action
      ? {
          children: action.label,
          onClick(event) {
            action.onClick?.(event)
            if (!event.defaultPrevented && toastId !== undefined) toastManager.close(toastId)
          },
        }
      : undefined,
    data: { icon, cancel, closeButton },
  }
}

let toastCount = 0

function show(type: ToastType | undefined, message: RemixNode, options?: ToastOptions) {
  let id = options?.id ?? `toast-${++toastCount}`
  return toastManager.add(toAddOptions(type, message, { ...options, id }))
}

type PromiseState<Value> = RemixNode | ((value: Value) => RemixNode)

export interface ToastPromiseOptions<Value> extends Omit<ToastOptions, 'id'> {
  loading: RemixNode
  success: PromiseState<Value>
  error: PromiseState<unknown>
}

function resolveState<Value>(state: PromiseState<Value>, value: Value): RemixNode {
  return typeof state === 'function' ? (state as (value: Value) => RemixNode)(value) : state
}

/**
 * Shows a toast and returns its id. Mirrors Sonner: `toast('Saved')`, `toast.success(...)`,
 * `toast.error(...)`, `toast.info(...)`, `toast.warning(...)`, `toast.loading(...)`,
 * `toast.promise(promise, { loading, success, error })`, `toast.dismiss(id?)`.
 */
export const toast: ((message: RemixNode, options?: ToastOptions) => string) & {
  message(message: RemixNode, options?: ToastOptions): string
  success(message: RemixNode, options?: ToastOptions): string
  error(message: RemixNode, options?: ToastOptions): string
  info(message: RemixNode, options?: ToastOptions): string
  warning(message: RemixNode, options?: ToastOptions): string
  loading(message: RemixNode, options?: ToastOptions): string
  promise<Value>(
    promise: Promise<Value> | (() => Promise<Value>),
    options: ToastPromiseOptions<Value>,
  ): { id: string; unwrap(): Promise<Value> }
  dismiss(id?: string): void
} = Object.assign(
  (message: RemixNode, options?: ToastOptions) => show(undefined, message, options),
  {
    message: (message: RemixNode, options?: ToastOptions) => show(undefined, message, options),
    success: (message: RemixNode, options?: ToastOptions) => show('success', message, options),
    error: (message: RemixNode, options?: ToastOptions) => show('error', message, options),
    info: (message: RemixNode, options?: ToastOptions) => show('info', message, options),
    warning: (message: RemixNode, options?: ToastOptions) => show('warning', message, options),
    loading: (message: RemixNode, options?: ToastOptions) => show('loading', message, options),
    promise<Value>(
      input: Promise<Value> | (() => Promise<Value>),
      options: ToastPromiseOptions<Value>,
    ) {
      let promise = typeof input === 'function' ? input() : input
      let { loading, success, error, ...rest } = options
      let id = show('loading', loading, rest)
      promise.then(
        (value) => show('success', resolveState(success, value), { ...rest, id }),
        (reason: unknown) => show('error', resolveState(error, reason), { ...rest, id }),
      )
      return { id, unwrap: () => promise }
    },
    dismiss: (id?: string) => toastManager.close(id),
  },
)

export type ToasterProps = Omit<Props<'div'>, 'children'> & {
  /** @default 'bottom-right' */
  position?: ToasterPosition
  /** Show a close button on every toast. @default false */
  closeButton?: boolean
  /** Default time in ms before toasts close. @default 4000 */
  duration?: number
  /** How many toasts are visible at once. @default 3 */
  visibleToasts?: number
  /** Keep the stack expanded instead of fanning out on hover. @default false */
  expand?: boolean
  /** Render another manager's toasts instead of the `toast()` helper's. */
  toastManager?: toastPrimitive.ToastManager
  /** Override the swipe-to-dismiss directions (derived from `position` by default). */
  swipeDirection?: toastPrimitive.ToastSwipeDirection[]
}

/** Renders toasts from `toast()`. Place it once, e.g. at the end of your root layout. */
export function Toaster(handle: Handle<ToasterProps>) {
  return () => {
    let { toastManager: manager, duration = 4000, visibleToasts = 3, ...props } = handle.props
    return (
      <toastPrimitive.Context
        toastManager={manager ?? toastManager}
        timeout={duration}
        limit={visibleToasts}
      >
        <ToasterViewport {...props} />
      </toastPrimitive.Context>
    )
  }
}

type ToasterViewportProps = Omit<ToasterProps, 'toastManager' | 'duration' | 'visibleToasts'>

function ToasterViewport(handle: Handle<ToasterViewportProps>) {
  let context = handle.context.get(toastPrimitive.Context)

  return () => {
    let {
      class: className,
      mix,
      position = 'bottom-right',
      closeButton = false,
      expand = false,
      swipeDirection,
      ...props
    } = handle.props
    let [y, x] = position.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right']
    let directions: toastPrimitive.ToastSwipeDirection[] = swipeDirection ?? [
      y === 'top' ? 'up' : 'down',
      ...(x === 'center' ? [] : [x]),
    ]

    return (
      <div
        data-slot="toaster"
        data-y-position={y}
        data-x-position={x}
        data-expand={expand ? '' : undefined}
        {...props}
        class={cn(
          'group/toaster fixed z-[100] w-[356px] max-w-[calc(100vw-2rem)] outline-none [--gap:14px] [--lift:-1] [--peek:14px] data-[y-position=top]:[--lift:1]',
          'data-[y-position=bottom]:bottom-4 data-[y-position=top]:top-4 sm:data-[y-position=bottom]:bottom-6 sm:data-[y-position=top]:top-6',
          'data-[x-position=left]:left-4 data-[x-position=right]:right-4 sm:data-[x-position=left]:left-6 sm:data-[x-position=right]:right-6',
          'data-[x-position=center]:left-1/2 data-[x-position=center]:-translate-x-1/2',
          className,
        )}
        mix={[toastPrimitive.viewport(), mix]}
      >
        {context.toasts.map((item) => (
          <ToastCard
            key={item.id}
            toast={item}
            expand={expand}
            swipeDirection={directions}
            closeButton={closeButton}
          />
        ))}
      </div>
    )
  }
}

function ToastCard(
  handle: Handle<{
    toast: toastPrimitive.ToastObject<ToastData>
    expand: boolean
    swipeDirection: toastPrimitive.ToastSwipeDirection[]
    closeButton: boolean
  }>,
) {
  return () => {
    let { toast: item, expand, swipeDirection, closeButton } = handle.props
    let data = item.data ?? {}
    let icon =
      data.icon !== undefined ? data.icon : item.type ? typeIcons[item.type]?.() : undefined
    let showClose = data.closeButton ?? closeButton
    let cancel = data.cancel

    return (
      <div
        data-slot="toast"
        data-force-expanded={expand ? '' : undefined}
        class={cn(
          // Stack geometry (see Base UI's toast docs): --lift is -1 for bottom toasters, 1 for top.
          '[--scale:calc(1-var(--toast-index,0)*0.05)] [--shrink:calc(1-var(--scale))] [--height:var(--toast-frontmost-height,var(--toast-height,0px))] [--exit-x:0px] [--exit-y:0px]',
          '[--y:calc(var(--toast-swipe-movement-y,0px)+var(--lift)*(var(--toast-index,0)*var(--peek)+var(--shrink)*var(--height)))]',
          'data-expanded:[--scale:1] data-expanded:[--y:calc(var(--toast-swipe-movement-y,0px)+var(--lift)*(var(--toast-offset-y,0px)+var(--toast-index,0)*var(--gap)))]',
          'data-force-expanded:[--scale:1] data-force-expanded:[--y:calc(var(--toast-swipe-movement-y,0px)+var(--lift)*(var(--toast-offset-y,0px)+var(--toast-index,0)*var(--gap)))]',
          'absolute inset-x-0 z-[calc(1000-var(--toast-index,0))] h-[var(--toast-frontmost-height,var(--toast-height,auto))] data-expanded:h-[var(--toast-height,auto)] data-force-expanded:h-[var(--toast-height,auto)]',
          'group-data-[y-position=bottom]/toaster:bottom-0 group-data-[y-position=bottom]/toaster:origin-bottom group-data-[y-position=top]/toaster:top-0 group-data-[y-position=top]/toaster:origin-top',
          '[transform:translateX(calc(var(--toast-swipe-movement-x,0px)+var(--exit-x)))_translateY(calc(var(--y)+var(--exit-y)))_scale(var(--scale))]',
          'transition-[transform,opacity,height] duration-400 ease-[cubic-bezier(0.21,1.02,0.73,1)] data-swiping:transition-none motion-reduce:transition-none',
          // Enter from (and leave toward) the screen edge; swiped toasts leave in the swipe direction.
          'data-starting-style:opacity-0 data-starting-style:[--exit-y:calc(var(--lift)*-100%)]',
          'data-ending-style:opacity-0 [&[data-ending-style]:not([data-swipe-direction])]:[--exit-y:calc(var(--lift)*-100%)]',
          'data-ending-style:data-[swipe-direction=right]:[--exit-x:100%] data-ending-style:data-[swipe-direction=left]:[--exit-x:-100%] data-ending-style:data-[swipe-direction=down]:[--exit-y:100%] data-ending-style:data-[swipe-direction=up]:[--exit-y:-100%]',
          'data-limited:pointer-events-none data-limited:opacity-0',
          // Fill the gap between expanded toasts so the stack stays hovered.
          "after:absolute after:inset-x-0 after:h-[calc(var(--gap)+1px)] after:content-[''] group-data-[y-position=bottom]/toaster:after:top-full group-data-[y-position=top]/toaster:after:bottom-full",
          // Card, like Sonner's default toast with shadcn's tokens.
          'box-border flex touch-none items-center rounded-lg border bg-popover p-4 text-[13px] text-popover-foreground shadow-lg outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        )}
        mix={toastPrimitive.root({ toast: item, swipeDirection })}
      >
        <div
          data-slot="toast-content"
          class={cn(
            'flex w-full items-center gap-1.5 transition-opacity duration-400 data-behind:opacity-0 data-expanded:opacity-100',
            expand && 'opacity-100!',
          )}
          mix={toastPrimitive.content({ toast: item })}
        >
          {icon ? (
            <span data-slot="toast-icon" class="flex size-4 shrink-0 items-center justify-center">
              {icon}
            </span>
          ) : null}
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            {item.title != null ? (
              <div
                data-slot="toast-title"
                class="leading-normal font-medium"
                mix={toastPrimitive.title({ toast: item })}
              >
                {item.title}
              </div>
            ) : null}
            {item.description != null ? (
              <div
                data-slot="toast-description"
                class="leading-snug text-muted-foreground"
                mix={toastPrimitive.description({ toast: item })}
              >
                {item.description}
              </div>
            ) : null}
          </div>
          {cancel ? (
            <button
              data-slot="toast-cancel"
              class="ml-auto h-6 shrink-0 rounded-sm bg-muted px-2 text-xs font-medium text-muted-foreground outline-none hover:bg-muted/80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              mix={[
                toastPrimitive.close({ toast: item }),
                on('click', (event) => cancel.onClick?.(event)),
              ]}
            >
              {cancel.label}
            </button>
          ) : null}
          {item.actionProps ? (
            <button
              data-slot="toast-action"
              class="ml-auto h-6 shrink-0 rounded-sm bg-primary px-2 text-xs font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              mix={toastPrimitive.action({ toast: item })}
            >
              {item.actionProps.children}
            </button>
          ) : null}
        </div>
        {showClose ? (
          <button
            data-slot="toast-close"
            aria-label="Close"
            class="absolute -top-1.5 -left-1.5 flex size-5 items-center justify-center rounded-full border bg-popover text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-3"
            mix={toastPrimitive.close({ toast: item })}
          >
            <XIcon />
          </button>
        ) : null}
      </div>
    )
  }
}

function Icon(handle: Handle<{ class?: string; children?: RemixNode }>) {
  return () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={cn('size-4', handle.props.class)}
    >
      {handle.props.children}
    </svg>
  )
}

function XIcon() {
  return () => (
    <Icon>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  )
}

// Lucide icons, as in shadcn's Toaster: CircleCheck, OctagonX, Info, TriangleAlert, Loader2.
const typeIcons: Record<string, () => RemixNode> = {
  success: () => (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  ),
  error: () => (
    <Icon>
      <path d="M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </Icon>
  ),
  info: () => (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Icon>
  ),
  warning: () => (
    <Icon>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Icon>
  ),
  loading: () => (
    <Icon class="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </Icon>
  ),
}

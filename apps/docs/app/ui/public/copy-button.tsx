import { clientEntry, on, type Handle } from 'remix/component'

export interface CopyButtonProps {
  /** Text to copy. */
  text?: string
  /** Or the id of an element whose text content is copied. */
  target?: string
  label?: string
  class?: string
}

/** A small "Copy" button. Copies `text`, or the text of the element with id `target`. */
export const CopyButton = clientEntry(
  import.meta.url,
  function CopyButton(handle: Handle<CopyButtonProps>) {
    let copied = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function copy() {
      let { text, target } = handle.props
      let value = text ?? (target ? document.getElementById(target)?.textContent : undefined)
      if (value == null) return
      try {
        await navigator.clipboard.writeText(value)
      } catch {
        // Clipboard access can be denied (insecure context, permissions). Fall back to selection.
        let range = document.createRange()
        let node = target ? document.getElementById(target) : null
        if (!node) return
        range.selectNodeContents(node)
        let selection = getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        document.execCommand('copy')
      }
      copied = true
      clearTimeout(timer)
      timer = setTimeout(() => {
        copied = false
        void handle.update()
      }, 1500)
      void handle.update()
    }

    return () => {
      let { label = 'Copy', class: className } = handle.props
      return (
        <button
          type="button"
          aria-label={copied ? 'Copied' : label}
          title={copied ? 'Copied' : label}
          data-copied={copied ? '' : undefined}
          class={`inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${className ?? ''}`}
          mix={on('click', () => void copy())}
        >
          {copied ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              class="size-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              class="size-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          )}
        </button>
      )
    }
  },
)

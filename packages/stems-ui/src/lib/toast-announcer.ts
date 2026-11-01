/**
 * Visually hidden live regions that announce toasts.
 *
 * A live region only announces changes made after it is in the accessibility tree, so a toast
 * that is inserted together with its own `aria-live` attribute is often missed. Instead, two
 * persistent regions are appended to `<body>` while a `<toast.Context>` is mounted:
 *
 * - `role="status"` / `aria-live="polite"` for `priority: 'low'` toasts
 * - `role="alert"` / `aria-live="assertive"` for `priority: 'high'` toasts
 *
 * Each announcement is appended as a new child (additions are announced reliably) and removed
 * after a few seconds.
 */

const visuallyHidden =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;' +
  'clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;'

const CLEAR_DELAY = 5000

export interface ToastAnnouncer {
  announce(text: string, priority: 'low' | 'high'): void
  release(): void
}

let regions: { polite: HTMLElement; assertive: HTMLElement } | null = null
let users = 0

function createRegion(doc: Document, live: 'polite' | 'assertive') {
  let region = doc.createElement('div')
  region.setAttribute('role', live === 'polite' ? 'status' : 'alert')
  region.setAttribute('aria-live', live)
  region.setAttribute('aria-atomic', 'false')
  region.setAttribute('aria-relevant', 'additions text')
  region.setAttribute('data-stems-toast-announcer', live)
  region.setAttribute('style', visuallyHidden)
  doc.body.append(region)
  return region
}

/** Returns the shared announcer, creating its regions on first use. Call `release()` when done. */
export function acquireToastAnnouncer(doc: Document = document): ToastAnnouncer {
  if (!regions || !regions.polite.isConnected) {
    regions = { polite: createRegion(doc, 'polite'), assertive: createRegion(doc, 'assertive') }
  }
  users++
  let released = false

  return {
    announce(text, priority) {
      if (!regions || !text) return
      let region = priority === 'high' ? regions.assertive : regions.polite
      let message = doc.createElement('div')
      message.textContent = text
      region.append(message)
      setTimeout(() => message.remove(), CLEAR_DELAY)
    },
    release() {
      if (released) return
      released = true
      users--
      if (users === 0 && regions) {
        regions.polite.remove()
        regions.assertive.remove()
        regions = null
      }
    },
  }
}

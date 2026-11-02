import { clientEntry, on, type Handle } from 'remix/component'

/** localStorage key read by the inline script in document.tsx. */
export const THEME_STORAGE_KEY = 'theme'

/**
 * Toggles the `.dark` class on `<html>` and remembers the choice. The icon is chosen with CSS
 * (`dark:` variants), so the server-rendered button is correct before hydration.
 */
export const ThemeToggle = clientEntry(import.meta.url, function ThemeToggle(handle: Handle) {
  return () => (
    <button
      type="button"
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      data-testid="theme-toggle"
      class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      mix={on('click', () => {
        let dark = !document.documentElement.classList.contains('dark')
        document.documentElement.classList.toggle('dark', dark)
        try {
          localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light')
        } catch {
          // Storage can be unavailable (private mode); the toggle still works for this page.
        }
      })}
    >
      {/* Moon in light mode, sun in dark mode. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        class="size-4 dark:hidden"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        class="hidden size-4 dark:block"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2m-7.07-14.93 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    </button>
  )
})

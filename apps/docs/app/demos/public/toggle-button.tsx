import { clientEntry, type Handle } from 'remix/component'
import { ToggleButton, onToggleButtonChange } from '@stemsui/registry/ui/toggle-button.tsx'

function BoldIcon() {
  return () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />
    </svg>
  )
}

function ItalicIcon() {
  return () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <line x1="19" x2="10" y1="4" y2="4" />
      <line x1="14" x2="5" y1="20" y2="20" />
      <line x1="15" x2="9" y1="4" y2="20" />
    </svg>
  )
}

function UnderlineIcon() {
  return () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M6 4v6a6 6 0 0 0 12 0V4" />
      <line x1="4" x2="20" y1="20" y2="20" />
    </svg>
  )
}

export const ToggleButtonDemo = clientEntry(
  import.meta.url,
  function ToggleButtonDemo(handle: Handle) {
    let pressed: Record<string, boolean> = { bold: false, italic: true }

    return () => (
      <div
        class="flex flex-col items-center gap-4"
        mix={onToggleButtonChange((event) => {
          if (event.value) pressed[event.value] = event.pressed
          void handle.update()
        })}
      >
        <div class="flex items-center gap-2">
          <ToggleButton aria-label="Toggle bold" value="bold">
            <BoldIcon />
          </ToggleButton>
          <ToggleButton aria-label="Toggle italic" value="italic" variant="outline" defaultPressed>
            <ItalicIcon />
          </ToggleButton>
          <ToggleButton aria-label="Toggle underline" value="underline" disabled>
            <UnderlineIcon />
          </ToggleButton>
          <ToggleButton size="sm" variant="outline" value="sm">
            Small
          </ToggleButton>
          <ToggleButton size="lg" value="lg">
            Large
          </ToggleButton>
        </div>

        <p class="text-sm text-muted-foreground" data-testid="toggle-button-result">
          Bold <span class="font-medium text-foreground">{pressed.bold ? 'on' : 'off'}</span> ·
          Italic <span class="font-medium text-foreground">{pressed.italic ? 'on' : 'off'}</span>
        </p>
      </div>
    )
  },
)

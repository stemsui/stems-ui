import { clientEntry, on, type Handle } from 'remix/component'
import { Button, buttonVariants } from '@stemsui/registry/ui/button.tsx'

export const ButtonDemo = clientEntry(import.meta.url, function ButtonDemo(handle: Handle) {
  let saving = false
  let clicks = 0

  return () => (
    <div class="flex flex-col items-center gap-6">
      <div class="flex flex-wrap items-center justify-center gap-2">
        <Button
          mix={on('click', () => {
            clicks++
            void handle.update()
          })}
        >
          Default
        </Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" variant="outline">
          Small
        </Button>
        <Button variant="outline">Default</Button>
        <Button size="lg" variant="outline">
          Large
        </Button>
        <Button size="icon" variant="outline" aria-label="Add">
          <PlusIcon />
        </Button>
        <Button disabled>Disabled</Button>
        <a href="#button" class={buttonVariants({ variant: 'outline' })}>
          Link as button
        </a>
      </div>

      <div class="flex items-center gap-3">
        <Button
          disabled={saving}
          focusableWhenDisabled
          aria-labelledby="save-label"
          mix={on('click', () => {
            saving = true
            void handle.update()
            setTimeout(() => {
              saving = false
              void handle.update()
            }, 2000)
          })}
        >
          <span id="save-label">{saving ? 'Saving…' : 'Save (stays focusable)'}</span>
        </Button>
        <span class="text-sm text-muted-foreground" data-testid="button-clicks">
          Default clicked {clicks} {clicks === 1 ? 'time' : 'times'}
        </span>
      </div>
    </div>
  )
})

function PlusIcon() {
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
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

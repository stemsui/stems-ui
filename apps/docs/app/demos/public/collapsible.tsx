import { clientEntry, type Handle } from 'remix/component'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@stemsui/registry/ui/collapsible.tsx'

const rowClass = 'rounded-md border px-4 py-2 font-mono text-sm shadow-xs'

export const CollapsibleDemo = clientEntry(
  import.meta.url,
  function CollapsibleDemo(handle: Handle) {
    let open = false

    return () => (
      <Collapsible
        class="flex w-[350px] flex-col gap-2"
        open={open}
        onOpenChange={(next) => {
          open = next
          void handle.update()
        }}
      >
        <div class="flex items-center justify-between gap-4 px-4">
          <h4 class="text-sm font-semibold">Recovery keys</h4>
          <CollapsibleTrigger
            aria-label="Toggle recovery keys"
            class="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
          >
            <ChevronsUpDownIcon />
          </CollapsibleTrigger>
        </div>
        <div class={rowClass}>alien-bean-pasta</div>
        <CollapsibleContent class="flex h-(--collapsible-panel-height) flex-col gap-2 overflow-hidden transition-[height] duration-200 ease-out data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none">
          <div class={rowClass}>wild-irish-burrito</div>
          <div class={rowClass}>horse-battery-staple</div>
        </CollapsibleContent>
      </Collapsible>
    )
  },
)

function ChevronsUpDownIcon() {
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
      class="size-4"
    >
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </svg>
  )
}

import { clientEntry, type Handle, type RemixNode } from 'remix/component'
import { buttonVariants } from '@stemsui/registry/ui/button.tsx'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@stemsui/registry/ui/tooltip.tsx'

function Icon(handle: Handle<{ children: RemixNode }>) {
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
      {handle.props.children}
    </svg>
  )
}

const tools = [
  {
    label: 'Bold',
    shortcut: '⌘B',
    icon: <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />,
  },
  {
    label: 'Italic',
    shortcut: '⌘I',
    icon: (
      <>
        <line x1="19" x2="10" y1="4" y2="4" />
        <line x1="14" x2="5" y1="20" y2="20" />
        <line x1="15" x2="9" y1="4" y2="20" />
      </>
    ),
  },
  {
    label: 'Underline',
    shortcut: '⌘U',
    icon: (
      <>
        <path d="M6 4v6a6 6 0 0 0 12 0V4" />
        <line x1="4" x2="20" y1="20" y2="20" />
      </>
    ),
  },
  {
    label: 'Insert link',
    shortcut: '⌘K',
    icon: (
      <>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </>
    ),
  },
] as const

const sides = ['top', 'right', 'bottom', 'left'] as const

export const TooltipDemo = clientEntry(import.meta.url, function TooltipDemo(handle: Handle) {
  let lastChange = 'none'

  return () => (
    <div class="flex flex-col items-center gap-10">
      {/* One provider: once a tooltip is open, the neighbors open instantly. */}
      <TooltipProvider delay={600}>
        <div
          class="flex items-center gap-1 rounded-lg border p-1"
          role="toolbar"
          aria-label="Formatting"
        >
          {tools.map((tool) => (
            <Tooltip
              onOpenChange={(open, details) => {
                lastChange = `${tool.label} ${open ? 'opened' : 'closed'} (${details.reason})`
                void handle.update()
              }}
            >
              <TooltipTrigger
                aria-label={tool.label}
                class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                data-testid={`tool-${tool.label.toLowerCase().replace(' ', '-')}`}
              >
                <Icon>{tool.icon}</Icon>
              </TooltipTrigger>
              <TooltipContent>
                {tool.label}
                <kbd
                  data-slot="kbd"
                  class="inline-flex h-5 items-center rounded-sm bg-background/20 px-1 font-sans text-[0.7rem] text-background"
                >
                  {tool.shortcut}
                </kbd>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      <TooltipProvider>
        <div class="flex flex-wrap justify-center gap-2">
          {sides.map((side) => (
            <Tooltip>
              <TooltipTrigger
                class={buttonVariants({ variant: 'outline', size: 'sm' })}
                data-testid={`side-${side}`}
              >
                {side}
              </TooltipTrigger>
              <TooltipContent side={side}>Tooltip on the {side}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      <p class="text-sm text-muted-foreground" data-testid="tooltip-result">
        Last change: <span class="font-medium text-foreground">{lastChange}</span>
      </p>
    </div>
  )
})

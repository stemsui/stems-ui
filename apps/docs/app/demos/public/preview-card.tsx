import { clientEntry, type Handle } from 'remix/component'
import { Avatar, AvatarFallback, AvatarImage } from '@stemsui/registry/ui/avatar.tsx'
import { buttonVariants } from '@stemsui/registry/ui/button.tsx'
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from '@stemsui/registry/ui/preview-card.tsx'

function CalendarIcon() {
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
      class="size-4 opacity-70"
    >
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  )
}

export const PreviewCardDemo = clientEntry(
  import.meta.url,
  function PreviewCardDemo(handle: Handle) {
    let lastChange = 'none'

    return () => (
      <div class="flex flex-col items-center gap-10">
        <PreviewCard
          onOpenChange={(open, details) => {
            lastChange = `${open ? 'opened' : 'closed'} (${details.reason})`
            void handle.update()
          }}
        >
          <PreviewCardTrigger
            href="https://github.com/remix-run"
            class={buttonVariants({ variant: 'link' })}
            data-testid="remix-link"
          >
            @remix-run
          </PreviewCardTrigger>
          <PreviewCardContent class="w-80">
            <div class="flex justify-between gap-4">
              <Avatar>
                <AvatarImage src="https://github.com/remix-run.png" alt="@remix-run" />
                <AvatarFallback>RR</AvatarFallback>
              </Avatar>
              <div class="flex flex-col gap-1">
                <h4 class="text-sm font-semibold">@remix-run</h4>
                <p class="text-sm">
                  Remix 3 – build better websites with web standards, created and maintained by
                  @shopify.
                </p>
                <div class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarIcon />
                  <span>Open source since 2021</span>
                </div>
              </div>
            </div>
          </PreviewCardContent>
        </PreviewCard>

        {/* A <div>, not a <p>: the card is a <div> and can't live inside a paragraph. */}
        <div class="max-w-md text-center text-sm text-muted-foreground">
          Stems UI components are built on{' '}
          <PreviewCard>
            <PreviewCardTrigger
              href="https://github.com/remix-run/remix"
              class="font-medium text-foreground underline underline-offset-4"
              delay={300}
              data-testid="mixins-link"
            >
              Remix mixins
            </PreviewCardTrigger>
            <PreviewCardContent side="top" class="w-64 text-left">
              <p class="text-sm">
                <strong>Mixins</strong> attach behavior to elements you render yourself:{' '}
                <code class="rounded bg-muted px-1 font-mono text-xs whitespace-nowrap">
                  mix={'{'}tooltip.trigger(){'}'}
                </code>
                .
              </p>
            </PreviewCardContent>
          </PreviewCard>
          , so you own every element.
        </div>

        <p class="text-sm text-muted-foreground" data-testid="preview-card-result">
          Last change: <span class="font-medium text-foreground">{lastChange}</span>
        </p>
      </div>
    )
  },
)

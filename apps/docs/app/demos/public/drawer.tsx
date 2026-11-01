import { clientEntry, on, type Handle } from 'remix/component'
import { buttonVariants } from '@stemsui/registry/ui/button.tsx'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@stemsui/registry/ui/drawer.tsx'

export const DrawerDemo = clientEntry(import.meta.url, function DrawerDemo(handle: Handle) {
  let goal = 350
  let lastClose = 'none yet'

  function adjust(delta: number) {
    goal = Math.max(200, Math.min(400, goal + delta))
    void handle.update()
  }

  function track(open: boolean, reason: string) {
    if (open) return
    lastClose = reason
    void handle.update()
  }

  return () => (
    <div class="flex flex-col items-center gap-4">
      <div class="flex flex-wrap justify-center gap-2">
        <Drawer showSwipeHandle onOpenChange={(open, details) => track(open, details.reason)}>
          <DrawerTrigger class={buttonVariants({ variant: 'outline' })}>Open Drawer</DrawerTrigger>
          <DrawerContent data-testid="bottom-drawer">
            <div class="mx-auto w-full max-w-sm">
              <DrawerHeader>
                <DrawerTitle>Move Goal</DrawerTitle>
                <DrawerDescription>Set your daily activity goal.</DrawerDescription>
              </DrawerHeader>
              <div class="p-4 pb-0">
                <div class="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    aria-label="Decrease"
                    class={buttonVariants({
                      variant: 'outline',
                      size: 'icon',
                      class: 'size-8 shrink-0 rounded-full',
                    })}
                    disabled={goal <= 200}
                    mix={on('click', () => adjust(-10))}
                  >
                    −
                  </button>
                  <div class="flex-1 text-center">
                    <div class="text-7xl font-bold tracking-tighter">{goal}</div>
                    <div class="text-[0.70rem] text-muted-foreground uppercase">Calories/day</div>
                  </div>
                  <button
                    type="button"
                    aria-label="Increase"
                    class={buttonVariants({
                      variant: 'outline',
                      size: 'icon',
                      class: 'size-8 shrink-0 rounded-full',
                    })}
                    disabled={goal >= 400}
                    mix={on('click', () => adjust(10))}
                  >
                    +
                  </button>
                </div>
                <div class="mt-3 flex h-[120px] items-end gap-1">
                  {[60, 80, 45, 90, 70, 100, 55, 85, 65, 95, 75, 50].map((height) => (
                    <div
                      class="flex-1 rounded-t-sm bg-primary/80"
                      style={{ height: `${(height * goal) / 400}%` }}
                    />
                  ))}
                </div>
              </div>
              <DrawerFooter>
                <DrawerClose class={buttonVariants()}>Submit</DrawerClose>
                <DrawerClose class={buttonVariants({ variant: 'outline' })}>Cancel</DrawerClose>
              </DrawerFooter>
            </div>
          </DrawerContent>
        </Drawer>

        <Drawer
          swipeDirection="right"
          onOpenChange={(open, details) => track(open, details.reason)}
        >
          <DrawerTrigger class={buttonVariants({ variant: 'outline' })}>Open Right</DrawerTrigger>
          <DrawerContent data-testid="right-drawer">
            <DrawerHeader>
              <DrawerTitle>Notifications</DrawerTitle>
              <DrawerDescription>
                Swipe right, press Escape, or click outside to close.
              </DrawerDescription>
            </DrawerHeader>
            <div class="flex flex-col gap-2 p-4 text-sm">
              <p>You have 3 unread messages.</p>
              <p class="text-muted-foreground">Your weekly summary is ready.</p>
            </div>
            <DrawerFooter>
              <DrawerClose class={buttonVariants({ variant: 'outline' })}>Close</DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
      <p class="text-sm text-muted-foreground" data-testid="drawer-result">
        Goal: <span class="font-medium text-foreground">{goal}</span> · Last close:{' '}
        <span class="font-medium text-foreground">{lastClose}</span>
      </p>
    </div>
  )
})

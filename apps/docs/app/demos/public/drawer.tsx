import { clientEntry, on, type Handle } from 'remix/component'
import { buttonVariants } from '@stemsui/registry/ui/button.tsx'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerSwipeArea,
  DrawerTitle,
  DrawerTrigger,
  type DrawerSnapPoint,
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

        <SnapPointsExample />
      </div>
      <SwipeAreaExample />
      <p class="text-sm text-muted-foreground" data-testid="drawer-result">
        Goal: <span class="font-medium text-foreground">{goal}</span> · Last close:{' '}
        <span class="font-medium text-foreground">{lastClose}</span>
      </p>
    </div>
  )
})

const snapPoints: DrawerSnapPoint[] = ['220px', 1]

/** A bottom sheet that rests at a 220px peek and expands to full height. */
function SnapPointsExample(handle: Handle) {
  let snapPoint: DrawerSnapPoint | null = snapPoints[0]

  function setSnapPoint(next: DrawerSnapPoint | null) {
    snapPoint = next
    void handle.update()
  }

  return () => (
    <Drawer
      showSwipeHandle
      snapPoints={snapPoints}
      snapPoint={snapPoint}
      onSnapPointChange={(next) => setSnapPoint(next)}
    >
      <DrawerTrigger class={buttonVariants({ variant: 'outline' })}>Snap Points</DrawerTrigger>
      <DrawerContent data-testid="snap-drawer">
        <DrawerHeader>
          <DrawerTitle>Recent activity</DrawerTitle>
          <DrawerDescription>
            Drag the sheet up to expand it, or down to collapse and close it.
          </DrawerDescription>
        </DrawerHeader>
        <div class="flex justify-center gap-2 p-4 pb-2">
          {/* Keyboard alternative to dragging: set the controlled snap point. */}
          <button
            type="button"
            class={buttonVariants({ variant: 'outline', size: 'sm' })}
            disabled={snapPoint === 1}
            mix={on('click', () => setSnapPoint(1))}
          >
            Expand
          </button>
          <button
            type="button"
            class={buttonVariants({ variant: 'outline', size: 'sm' })}
            disabled={snapPoint === snapPoints[0]}
            mix={on('click', () => setSnapPoint(snapPoints[0]))}
          >
            Collapse
          </button>
        </div>
        <p class="px-4 text-center text-xs text-muted-foreground" data-testid="snap-point">
          Snap point: {String(snapPoint)}
        </p>
        <ul class="flex min-h-0 flex-col gap-2 overflow-y-auto p-4">
          {Array.from({ length: 12 }, (_, index) => (
            <li class="rounded-md border p-3 text-sm">
              <div class="font-medium">Update {index + 1}</div>
              <div class="text-muted-foreground">Synced {index + 2} minutes ago</div>
            </li>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  )
}

/** A right-hand drawer opened by swiping in from the edge of a box. */
function SwipeAreaExample() {
  return () => (
    <Drawer swipeDirection="right">
      <div class="relative flex h-40 w-full max-w-md items-center justify-center overflow-hidden rounded-lg border border-dashed text-sm text-muted-foreground">
        <span class="pr-10">Swipe left from the right edge of this box.</span>
        <DrawerSwipeArea
          data-testid="drawer-swipe-area"
          class="absolute inset-y-0 right-0 w-8 border-l-2 border-dashed border-primary/40 bg-primary/5 data-swiping:bg-primary/10"
        />
      </div>
      <DrawerContent data-testid="swipe-area-drawer">
        <DrawerHeader>
          <DrawerTitle>Library</DrawerTitle>
          <DrawerDescription>Opened by swiping in from the edge.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <DrawerClose class={buttonVariants({ variant: 'outline' })}>Close</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

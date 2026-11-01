import { clientEntry, on, type Handle } from 'remix/component'
import { Progress, ProgressLabel, ProgressValue } from '@stemsui/registry/ui/progress.tsx'

export const ProgressDemo = clientEntry(import.meta.url, function ProgressDemo(handle: Handle) {
  let value = 13
  let running = true

  // Browser-only: advance the bar over time.
  handle.queueTask(() => {
    let timer = setInterval(() => {
      if (!running) return
      value = value >= 100 ? 0 : Math.min(100, value + Math.round(Math.random() * 15 + 5))
      void handle.update()
    }, 800)
    handle.signal.addEventListener('abort', () => clearInterval(timer))
  })

  return () => (
    <div class="flex w-full max-w-sm flex-col gap-8">
      <Progress value={value}>
        <ProgressLabel>Export data</ProgressLabel>
        <ProgressValue />
      </Progress>

      <Progress value={null}>
        <ProgressLabel>Waiting for server</ProgressLabel>
      </Progress>

      <Progress value={3} max={10} getAriaValueText={(_, current) => `${current} of 10 files`}>
        <ProgressLabel>Uploading</ProgressLabel>
        <ProgressValue>3 of 10 files</ProgressValue>
      </Progress>

      <button
        type="button"
        class="self-start text-sm text-muted-foreground underline underline-offset-4"
        mix={on('click', () => {
          running = !running
          void handle.update()
        })}
      >
        {running ? 'Pause' : 'Resume'}
      </button>
    </div>
  )
})

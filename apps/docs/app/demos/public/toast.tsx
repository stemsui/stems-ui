import { clientEntry, on, type Handle } from 'remix/component'
import { toast, Toaster } from '@stemsui/registry/ui/toast.tsx'

const buttonClass =
  'inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50'

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export const ToastDemo = clientEntry(import.meta.url, function ToastDemo(_handle: Handle) {
  let count = 0

  return () => (
    <div class="flex flex-wrap justify-center gap-2">
      <button
        type="button"
        class={buttonClass}
        data-testid="toast-default"
        mix={on('click', () => {
          count++
          toast('Event has been created', {
            description: `Sunday, December 03, 2023 at 9:00 AM (#${count})`,
          })
        })}
      >
        Default
      </button>
      <button
        type="button"
        class={buttonClass}
        data-testid="toast-success"
        mix={on('click', () => void toast.success('Event has been created'))}
      >
        Success
      </button>
      <button
        type="button"
        class={buttonClass}
        data-testid="toast-error"
        mix={on(
          'click',
          () =>
            void toast.error('Something went wrong', {
              description: 'There was a problem with your request.',
            }),
        )}
      >
        Error
      </button>
      <button
        type="button"
        class={buttonClass}
        data-testid="toast-info"
        mix={on('click', () => void toast.info('Be at the area 10 minutes before the event time'))}
      >
        Info
      </button>
      <button
        type="button"
        class={buttonClass}
        data-testid="toast-warning"
        mix={on('click', () => void toast.warning('Event start time cannot be earlier than 8am'))}
      >
        Warning
      </button>
      <button
        type="button"
        class={buttonClass}
        data-testid="toast-action"
        mix={on(
          'click',
          () =>
            void toast('Event has been deleted', {
              description: 'You can undo this for a few seconds.',
              action: { label: 'Undo', onClick: () => void toast.success('Event restored') },
            }),
        )}
      >
        With action
      </button>
      <button
        type="button"
        class={buttonClass}
        data-testid="toast-promise"
        mix={on('click', () => {
          toast.promise(
            wait(2000).then(() => ({ name: 'Event' })),
            {
              loading: 'Loading...',
              success: (data) => `${data.name} has been created`,
              error: 'Error',
            },
          )
        })}
      >
        Promise
      </button>
      <Toaster />
    </div>
  )
})

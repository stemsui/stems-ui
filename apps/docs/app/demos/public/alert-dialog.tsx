import { clientEntry, on, type Handle } from 'remix/component'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@stemsui/registry/ui/alert-dialog.tsx'
import { buttonVariants } from '@stemsui/registry/ui/button.tsx'

export const AlertDialogDemo = clientEntry(
  import.meta.url,
  function AlertDialogDemo(handle: Handle) {
    let result = 'none yet'

    return () => (
      <div class="flex flex-col items-center gap-4">
        <AlertDialog
          onOpenChange={(open, details) => {
            if (!open && details.reason !== 'close-press') {
              result = `dismissed (${details.reason})`
              void handle.update()
            }
          }}
        >
          <AlertDialogTrigger class={buttonVariants({ variant: 'outline' })}>
            Show Dialog
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your account and remove
                your data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                mix={on('click', () => {
                  result = 'cancelled'
                  void handle.update()
                })}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                closes
                mix={on('click', () => {
                  result = 'continued'
                  void handle.update()
                })}
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <p class="text-sm text-muted-foreground" data-testid="alert-dialog-result">
          Last choice: <span class="font-medium text-foreground">{result}</span>
        </p>
      </div>
    )
  },
)

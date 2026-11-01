import { clientEntry, on, type Handle } from 'remix/component'
import {
  OTPField,
  OTPFieldGroup,
  OTPFieldSeparator,
  OTPFieldSlot,
} from '@stemsui/registry/ui/otp-field.tsx'

export const OtpFieldDemo = clientEntry(import.meta.url, function OtpFieldDemo(handle: Handle) {
  let code = ''
  let completed: string | null = null
  let submitted: string | null = null

  return () => (
    <div class="flex w-full max-w-sm flex-col gap-8">
      <div class="flex flex-col gap-2">
        <label for="verification-code" class="text-sm leading-none font-medium select-none">
          Verification code
        </label>
        <OTPField
          id="verification-code"
          length={6}
          value={code}
          aria-describedby="verification-code-description"
          onValueChange={(value) => {
            code = value
            void handle.update()
          }}
          onValueComplete={(value) => {
            completed = value
            void handle.update()
          }}
        >
          <OTPFieldGroup>
            <OTPFieldSlot index={0} />
            <OTPFieldSlot index={1} aria-label="Character 2 of 6" />
            <OTPFieldSlot index={2} aria-label="Character 3 of 6" />
          </OTPFieldGroup>
          <OTPFieldSeparator />
          <OTPFieldGroup>
            <OTPFieldSlot index={3} aria-label="Character 4 of 6" />
            <OTPFieldSlot index={4} aria-label="Character 5 of 6" />
            <OTPFieldSlot index={5} aria-label="Character 6 of 6" />
          </OTPFieldGroup>
        </OTPField>
        <p id="verification-code-description" class="text-sm text-muted-foreground">
          Enter the 6-digit code.{' '}
          <span data-testid="otp-state">
            Value: <code class="font-mono text-foreground">{code || '(empty)'}</code>
            {completed ? ` · completed ${completed}` : ''}
          </span>
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <label for="recovery-code" class="text-sm leading-none font-medium select-none">
          Recovery code (letters and digits, masked)
        </label>
        <OTPField
          id="recovery-code"
          length={4}
          validationType="alphanumeric"
          normalizeValue={(value) => value.toUpperCase()}
          mask
        >
          <OTPFieldGroup>
            <OTPFieldSlot index={0} />
            <OTPFieldSlot index={1} aria-label="Character 2 of 4" />
            <OTPFieldSlot index={2} aria-label="Character 3 of 4" />
            <OTPFieldSlot index={3} aria-label="Character 4 of 4" />
          </OTPFieldGroup>
        </OTPField>
      </div>

      <form
        class="flex flex-col gap-3 rounded-lg border p-4"
        mix={on('submit', (event) => {
          event.preventDefault()
          let entries = [...new FormData(event.currentTarget).entries()]
          submitted = entries.map(([key, value]) => `${key}=${String(value)}`).join('&')
          void handle.update()
        })}
      >
        <label for="pin" class="text-sm leading-none font-medium select-none">
          PIN (submits when complete)
        </label>
        <OTPField id="pin" name="pin" length={4} required autoSubmit>
          <OTPFieldGroup>
            <OTPFieldSlot index={0} />
            <OTPFieldSlot index={1} aria-label="Digit 2 of 4" />
            <OTPFieldSlot index={2} aria-label="Digit 3 of 4" />
            <OTPFieldSlot index={3} aria-label="Digit 4 of 4" />
          </OTPFieldGroup>
        </OTPField>
        <p class="text-sm text-muted-foreground" data-testid="otp-form-result">
          Submitted: <code class="font-mono text-foreground">{submitted ?? '(not yet)'}</code>
        </p>
      </form>

      <OTPField length={4} defaultValue="12" disabled aria-label="Disabled code">
        <OTPFieldGroup>
          <OTPFieldSlot index={0} aria-label="Disabled character 1" />
          <OTPFieldSlot index={1} aria-label="Disabled character 2" />
          <OTPFieldSlot index={2} aria-label="Disabled character 3" />
          <OTPFieldSlot index={3} aria-label="Disabled character 4" />
        </OTPFieldGroup>
      </OTPField>
    </div>
  )
})

import { clientEntry, type Handle } from 'remix/component'
import { Button } from '@stemsui/registry/ui/button.tsx'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@stemsui/registry/ui/field.tsx'
import { Form, type FormErrors, type FormValues } from '@stemsui/registry/ui/form.tsx'
import { Input } from '@stemsui/registry/ui/input.tsx'

// Stands in for a server action: the request "fails" for some usernames.
async function submitToServer(values: FormValues): Promise<FormErrors> {
  await new Promise((resolve) => setTimeout(resolve, 600))
  let username = String(values.username ?? '')
  if (username === 'admin') return { username: `'admin' is reserved for system use.` }
  if (username.startsWith('ada')) return { username: `${username} is already taken.` }
  return {}
}

export const FormDemo = clientEntry(import.meta.url, function FormDemo(handle: Handle) {
  let errors: FormErrors = {}
  let pending = false
  let result: string | null = null

  return () => (
    <Form
      class="w-full max-w-sm"
      errors={errors}
      onClearErrors={(next) => {
        errors = next
      }}
      onFormSubmit={async (values) => {
        pending = true
        result = null
        void handle.update()
        errors = await submitToServer(values)
        pending = false
        if (Object.keys(errors).length === 0) result = `Saved ${String(values.username)}.`
        void handle.update()
      }}
      data-testid="form-demo"
    >
      <FieldGroup>
        <Field name="username">
          <FieldLabel>Username</FieldLabel>
          <Input
            required
            minLength={3}
            pattern="[a-z0-9]+"
            placeholder="ada"
            data-testid="form-username"
          />
          <FieldDescription>
            Lowercase letters and numbers. Try "admin" or "ada" for a server error.
          </FieldDescription>
          <FieldError match="valueMissing">Choose a username.</FieldError>
          <FieldError match="tooShort">Use at least 3 characters.</FieldError>
          <FieldError match="patternMismatch">Only lowercase letters and numbers.</FieldError>
          <FieldError match="customError" data-testid="form-username-server-error" />
        </Field>

        <Field
          name="age"
          validate={(value) =>
            value === '' || Number(value) >= 13 ? null : 'You must be at least 13.'
          }
        >
          <FieldLabel>Age</FieldLabel>
          <Input type="number" placeholder="36" data-testid="form-age" />
          <FieldError data-testid="form-age-error" />
        </Field>

        <div class="flex items-center gap-3">
          <Button type="submit" disabled={pending} data-testid="form-submit">
            {pending ? 'Submitting…' : 'Submit'}
          </Button>
          {result ? (
            <p class="text-sm text-muted-foreground" data-testid="form-result">
              {result}
            </p>
          ) : null}
        </div>
      </FieldGroup>
    </Form>
  )
})

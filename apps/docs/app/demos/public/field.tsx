import { clientEntry, type Handle } from 'remix/component'
import * as checkboxGroup from 'stems-ui/checkbox-group'
import * as field from 'stems-ui/field'
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from '@stemsui/registry/ui/autocomplete.tsx'
import { Button } from '@stemsui/registry/ui/button.tsx'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from '@stemsui/registry/ui/combobox.tsx'
import { Checkbox } from '@stemsui/registry/ui/checkbox.tsx'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@stemsui/registry/ui/field.tsx'
import { Form, type FormErrors, type FormValues } from '@stemsui/registry/ui/form.tsx'
import { Input } from '@stemsui/registry/ui/input.tsx'
import { NumberField } from '@stemsui/registry/ui/number-field.tsx'
import { OTPField, OTPFieldGroup, OTPFieldSlot } from '@stemsui/registry/ui/otp-field.tsx'
import { RadioGroup, RadioGroupItem } from '@stemsui/registry/ui/radio-group.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@stemsui/registry/ui/select.tsx'
import { Switch } from '@stemsui/registry/ui/switch.tsx'
import { Slider } from '@stemsui/registry/ui/slider.tsx'

const plans = [
  { value: 'hobby', label: 'Hobby' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
]

const storageTypes = [
  { value: 'ssd', label: 'SSD', description: 'Fast, for databases.' },
  { value: 'hdd', label: 'HDD', description: 'Cheap, for archives.' },
  { value: 'tape', label: 'Tape', description: 'Sold out.', disabled: true },
]

const protocols = ['http', 'https', 'ssh']

const regions = ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1']

const tags = ['web', 'api', 'worker', 'cron', 'database', 'cache']

const images = ['nginx:1.29-alpine', 'node:22-slim', 'postgres:18', 'redis:8.2-alpine']

// Stands in for a server action: the Enterprise plan "fails" on the server.
async function launch(values: FormValues): Promise<FormErrors> {
  await new Promise((resolve) => setTimeout(resolve, 400))
  if (values.plan === 'enterprise') return { plan: 'Enterprise needs a sales call first.' }
  return {}
}

function ControlsDemo(handle: Handle) {
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
        errors = await launch(values)
        pending = false
        if (Object.keys(errors).length === 0) result = JSON.stringify(values)
        void handle.update()
      }}
      data-testid="field-controls-form"
    >
      <FieldGroup>
        <Field name="plan">
          <FieldLabel>Plan</FieldLabel>
          <Select items={plans} required>
            <SelectTrigger class="w-48" data-testid="field-plan">
              <SelectValue placeholder="Choose a plan" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((plan) => (
                <SelectItem value={plan.value}>{plan.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>Pick Enterprise to see a server error.</FieldDescription>
          <FieldError match="valueMissing">Choose a plan.</FieldError>
          <FieldError match="customError" data-testid="field-plan-error" />
        </Field>

        <Field name="storage">
          <div class="text-sm leading-snug font-medium" mix={field.label()}>
            Storage
          </div>
          <RadioGroup required class="gap-3" data-testid="field-storage">
            {storageTypes.map((type) => (
              <field.ItemContext disabled={type.disabled}>
                <div class="flex items-start gap-3 data-disabled:opacity-50" mix={field.item()}>
                  <RadioGroupItem value={type.value} class="mt-0.5" />
                  <div class="flex flex-col gap-1">
                    <FieldLabel class="font-normal">{type.label}</FieldLabel>
                    <FieldDescription>{type.description}</FieldDescription>
                  </div>
                </div>
              </field.ItemContext>
            ))}
          </RadioGroup>
          <FieldError match="valueMissing">Choose a storage type.</FieldError>
        </Field>

        <Field
          name="protocols"
          validate={(value) =>
            (value as string[]).length === 0 ? 'Allow at least one protocol.' : null
          }
        >
          <div class="text-sm leading-snug font-medium" mix={field.label()}>
            Allowed protocols
          </div>
          <checkboxGroup.Context>
            <div class="flex gap-6" mix={checkboxGroup.root()} data-testid="field-protocols">
              {protocols.map((protocol) => (
                <field.ItemContext>
                  <div class="flex items-center gap-2" mix={field.item()}>
                    <Checkbox value={protocol} />
                    <FieldLabel class="font-normal uppercase">{protocol}</FieldLabel>
                  </div>
                </field.ItemContext>
              ))}
            </div>
          </checkboxGroup.Context>
          <FieldError data-testid="field-protocols-error" />
        </Field>

        <Field name="region">
          <FieldLabel>Region</FieldLabel>
          <Combobox items={regions} required>
            <ComboboxInput placeholder="Search regions" showClear data-testid="field-region" />
            <ComboboxContent>
              <ComboboxEmpty>No region found.</ComboboxEmpty>
              <ComboboxList>
                {(region: string) => (
                  <ComboboxItem key={region} value={region}>
                    {region}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <FieldError match="valueMissing">Choose a region.</FieldError>
        </Field>

        <Field
          name="tags"
          validate={(value) => ((value as string[]).length > 3 ? 'Use at most 3 tags.' : null)}
        >
          <FieldLabel>Tags</FieldLabel>
          <Combobox multiple items={tags} defaultValue={['web']}>
            <ComboboxChips data-testid="field-tags">
              <ComboboxValue>
                {(values: string[]) =>
                  values.map((value) => (
                    <ComboboxChip key={value} value={value}>
                      {value}
                    </ComboboxChip>
                  ))
                }
              </ComboboxValue>
              <ComboboxChipsInput placeholder="Add a tag" />
            </ComboboxChips>
            <ComboboxContent>
              <ComboboxEmpty>No tag found.</ComboboxEmpty>
              <ComboboxList>
                {(tag: string) => (
                  <ComboboxItem key={tag} value={tag}>
                    {tag}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <FieldError data-testid="field-tags-error" />
        </Field>

        <Field name="image">
          <FieldLabel>Image</FieldLabel>
          <Autocomplete items={images} required>
            <AutocompleteInput placeholder="e.g. nginx:1.29-alpine" data-testid="field-image" />
            <AutocompleteContent>
              <AutocompleteEmpty>No suggestions. Any image works.</AutocompleteEmpty>
              <AutocompleteList>
                {(image: string) => (
                  <AutocompleteItem key={image} value={image}>
                    {image}
                  </AutocompleteItem>
                )}
              </AutocompleteList>
            </AutocompleteContent>
          </Autocomplete>
          <FieldDescription>Free text, with suggestions.</FieldDescription>
          <FieldError match="valueMissing">Enter an image.</FieldError>
        </Field>

        <Field name="instances">
          <FieldLabel>Instances</FieldLabel>
          <NumberField required min={1} max={64} placeholder="1–64" data-testid="field-instances" />
          <FieldError match="valueMissing">How many instances?</FieldError>
          <FieldError match="rangeUnderflow">At least 1.</FieldError>
          <FieldError match="rangeOverflow">At most 64.</FieldError>
        </Field>

        <Field
          name="threshold"
          validate={(value) => {
            let [low, high] = value as number[]
            return high! - low! < 20 ? 'Keep the thresholds at least 20% apart.' : null
          }}
        >
          <div class="text-sm leading-snug font-medium" mix={field.label()}>
            Scaling threshold
          </div>
          <Slider defaultValue={[40, 50]} data-testid="field-threshold" />
          <FieldError data-testid="field-threshold-error" />
        </Field>

        <Field name="code">
          <FieldLabel>Verification code</FieldLabel>
          <OTPField length={6} required data-testid="field-code">
            <OTPFieldGroup>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <OTPFieldSlot aria-label={index === 0 ? undefined : `Digit ${index + 1}`} />
              ))}
            </OTPFieldGroup>
          </OTPField>
          <FieldError match="valueMissing">Enter the code from your app.</FieldError>
          <FieldError match="patternMismatch">Enter all 6 digits.</FieldError>
        </Field>

        <Field name="restart" orientation="horizontal">
          <Switch defaultChecked data-testid="field-restart" />
          <FieldLabel class="font-normal">Restart on failure</FieldLabel>
        </Field>

        <Field name="terms" orientation="horizontal">
          <Checkbox required data-testid="field-terms" />
          <FieldLabel class="font-normal">I accept the terms</FieldLabel>
          <FieldError match="valueMissing" class="sr-only">
            Accept the terms.
          </FieldError>
        </Field>

        <div class="flex flex-col gap-3">
          <Button type="submit" class="w-fit" disabled={pending} data-testid="field-launch">
            {pending ? 'Launching…' : 'Launch server'}
          </Button>
          {result ? (
            <code class="text-xs break-all text-muted-foreground" data-testid="field-result">
              {result}
            </code>
          ) : null}
        </div>
      </FieldGroup>
    </Form>
  )
}

export const FieldDemo = clientEntry(import.meta.url, function FieldDemo(_handle: Handle) {
  return () => (
    <div class="flex w-full max-w-sm flex-col gap-12">
      <FieldGroup class="w-full max-w-sm">
        <Field name="name" validationMode="onBlur">
          <FieldLabel>Name</FieldLabel>
          <Input required placeholder="Ada Lovelace" data-testid="field-name" />
          <FieldDescription>
            Visible on your profile. Validates when you leave the field.
          </FieldDescription>
          <FieldError match="valueMissing" data-testid="field-name-error">
            Please enter your name.
          </FieldError>
        </Field>

        <Field
          name="username"
          validationMode="onChange"
          validationDebounceTime={300}
          validate={(value) =>
            String(value).length < 3 ? 'Usernames need at least 3 characters.' : null
          }
        >
          <FieldLabel>Username</FieldLabel>
          <Input placeholder="ada" data-testid="field-username" />
          <FieldDescription>Validated as you type (debounced).</FieldDescription>
          <FieldError data-testid="field-username-error" />
        </Field>

        <Field name="email" validationMode="onBlur">
          <FieldLabel>Email</FieldLabel>
          <Input type="email" placeholder="you@example.com" data-testid="field-email" />
          <FieldError match="typeMismatch">Enter a valid email address.</FieldError>
        </Field>

        <Field disabled>
          <FieldLabel>Disabled</FieldLabel>
          <Input placeholder="Not editable" />
          <FieldDescription>
            The field disables its label, control, and description.
          </FieldDescription>
        </Field>
      </FieldGroup>

      <section class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <h3 class="text-sm font-semibold">Every control in a field</h3>
          <p class="text-sm text-muted-foreground">
            Every Stems control plugs into a Field: labels, descriptions, validation and server
            errors. Submit empty to see required errors; each radio and checkbox in a group gets its
            own label through <code>field.ItemContext</code>.
          </p>
        </div>
        <ControlsDemo />
      </section>
    </div>
  )
})

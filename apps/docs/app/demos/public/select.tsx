import { clientEntry, on, type Handle } from 'remix/component'
import { Button } from '@stemsui/registry/ui/button.tsx'
import { Label } from '@stemsui/registry/ui/label.tsx'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@stemsui/registry/ui/select.tsx'

const produce = [
  {
    label: 'Fruits',
    items: [
      { value: 'apple', label: 'Apple' },
      { value: 'banana', label: 'Banana' },
      { value: 'blueberry', label: 'Blueberry' },
      { value: 'grapes', label: 'Grapes' },
      { value: 'pineapple', label: 'Pineapple' },
    ],
  },
  {
    label: 'Vegetables',
    items: [
      { value: 'aubergine', label: 'Aubergine' },
      { value: 'broccoli', label: 'Broccoli' },
      { value: 'carrot', label: 'Carrot', disabled: true },
      { value: 'courgette', label: 'Courgette' },
      { value: 'leek', label: 'Leek' },
    ],
  },
]

const languages = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'rust', label: 'Rust' },
  { value: 'go', label: 'Go' },
  { value: 'swift', label: 'Swift' },
]

const timezones = [
  { value: 'utc', label: 'UTC' },
  { value: 'america/new_york', label: 'Eastern Time (ET)' },
  { value: 'america/chicago', label: 'Central Time (CT)' },
  { value: 'america/los_angeles', label: 'Pacific Time (PT)' },
  { value: 'europe/london', label: 'Greenwich Mean Time (GMT)' },
  { value: 'europe/berlin', label: 'Central European Time (CET)' },
  { value: 'asia/tokyo', label: 'Japan Standard Time (JST)' },
]

function languageSummary(value: string[]) {
  if (value.length === 0) return 'Select languages'
  let first = languages.find((language) => language.value === value[0])?.label ?? value[0]
  return value.length > 1 ? `${first} (+${value.length - 1} more)` : first
}

export const SelectDemo = clientEntry(import.meta.url, function SelectDemo(handle: Handle) {
  let submitted: Array<[string, string]> | null = null

  return () => (
    <div class="flex w-full max-w-sm flex-col gap-8">
      <div class="flex flex-col gap-2">
        <Label id="select-demo-produce-label">Produce</Label>
        <Select items={produce}>
          <SelectTrigger class="w-48" aria-labelledby="select-demo-produce-label">
            <SelectValue placeholder="Select produce" />
          </SelectTrigger>
          <SelectContent>
            {produce.map((group, index) => (
              <>
                {index > 0 ? <SelectSeparator /> : null}
                <SelectGroup>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.items.map((item) => (
                    <SelectItem value={item.value} disabled={item.disabled}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div class="flex flex-col gap-2">
        <Label id="select-demo-languages-label">Languages</Label>
        <Select multiple defaultValue={['javascript', 'typescript']} items={languages}>
          <SelectTrigger class="w-56" aria-labelledby="select-demo-languages-label">
            <SelectValue>{(value: string[]) => languageSummary(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {languages.map((language) => (
                <SelectItem value={language.value}>{language.label}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <form
        class="flex flex-col gap-3"
        mix={on<HTMLFormElement, 'submit'>('submit', (event) => {
          event.preventDefault()
          submitted = [...new FormData(event.currentTarget).entries()].map(([key, value]) => [
            key,
            String(value),
          ])
          void handle.update()
        })}
      >
        <div class="flex flex-col gap-2">
          <Label id="select-demo-timezone-label">Timezone</Label>
          <Select name="timezone" required items={timezones}>
            <SelectTrigger class="w-64" aria-labelledby="select-demo-timezone-label">
              <SelectValue placeholder="Select a timezone" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {timezones.map((timezone) => (
                  <SelectItem value={timezone.value}>{timezone.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Button type="submit" size="sm">
            Submit
          </Button>
        </div>
        <pre class="rounded-md bg-muted p-3 text-xs" data-testid="select-demo-output">
          {submitted
            ? submitted.map(([key, value]) => `${key}: ${value}`).join('\n') || '(empty)'
            : 'Submit the form to see its FormData.'}
        </pre>
      </form>
    </div>
  )
})

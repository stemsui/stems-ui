import { clientEntry, on, type Handle } from 'remix/component'
import { Button } from '@stemsui/registry/ui/button.tsx'
import { Label } from '@stemsui/registry/ui/label.tsx'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxValue,
} from '@stemsui/registry/ui/combobox.tsx'

interface Framework {
  value: string
  label: string
  disabled?: boolean
}

const frameworks: Array<{ value: string; items: Framework[] }> = [
  {
    value: 'Full-stack',
    items: [
      { value: 'remix', label: 'Remix' },
      { value: 'next', label: 'Next.js' },
      { value: 'nuxt', label: 'Nuxt' },
      { value: 'sveltekit', label: 'SvelteKit' },
      { value: 'astro', label: 'Astro' },
    ],
  },
  {
    value: 'UI libraries',
    items: [
      { value: 'react', label: 'React' },
      { value: 'vue', label: 'Vue' },
      { value: 'svelte', label: 'Svelte' },
      { value: 'solid', label: 'Solid' },
      { value: 'angular', label: 'Angular', disabled: true },
    ],
  },
]

const languages = [
  'JavaScript',
  'TypeScript',
  'Python',
  'Rust',
  'Go',
  'Swift',
  'Kotlin',
  'Elixir',
  'Haskell',
  'Ruby',
]

export const ComboboxDemo = clientEntry(import.meta.url, function ComboboxDemo(handle: Handle) {
  let submitted: Array<[string, string]> | null = null

  return () => (
    <div class="flex w-full max-w-sm flex-col gap-8">
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
          <Label for="combobox-demo-framework">Framework</Label>
          <Combobox items={frameworks} name="framework" required>
            <ComboboxInput
              id="combobox-demo-framework"
              class="w-64"
              placeholder="Select a framework"
              showClear
            />
            <ComboboxContent>
              <ComboboxEmpty>No framework found.</ComboboxEmpty>
              <ComboboxList>
                {(group: (typeof frameworks)[number], index: number) => (
                  <>
                    {index > 0 ? <ComboboxSeparator /> : null}
                    <ComboboxGroup>
                      <ComboboxLabel>{group.value}</ComboboxLabel>
                      <ComboboxCollection items={group.items}>
                        {(item: Framework) => (
                          <ComboboxItem key={item.value} value={item} disabled={item.disabled}>
                            {item.label}
                          </ComboboxItem>
                        )}
                      </ComboboxCollection>
                    </ComboboxGroup>
                  </>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
        <div>
          <Button type="submit" size="sm">
            Submit
          </Button>
        </div>
        <pre class="rounded-md bg-muted p-3 text-xs" data-testid="combobox-demo-output">
          {submitted
            ? submitted.map(([key, value]) => `${key}: ${value}`).join('\n') || '(empty)'
            : 'Submit the form to see its FormData.'}
        </pre>
      </form>

      <div class="flex flex-col gap-2">
        <Label for="combobox-demo-languages">Languages</Label>
        <Combobox multiple items={languages} defaultValue={['TypeScript', 'Rust']} name="languages">
          <ComboboxChips class="w-80">
            <ComboboxValue>
              {(values: string[]) =>
                values.map((value) => (
                  <ComboboxChip key={value} value={value}>
                    {value}
                  </ComboboxChip>
                ))
              }
            </ComboboxValue>
            <ComboboxChipsInput id="combobox-demo-languages" placeholder="Add a language" />
          </ComboboxChips>
          <ComboboxContent>
            <ComboboxEmpty>No language found.</ComboboxEmpty>
            <ComboboxList>
              {(item: string) => (
                <ComboboxItem key={item} value={item}>
                  {item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    </div>
  )
})

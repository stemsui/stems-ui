import { clientEntry, type Handle } from 'remix/component'
import { Label } from '@stemsui/registry/ui/label.tsx'
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompleteValue,
} from '@stemsui/registry/ui/autocomplete.tsx'

const tags = [
  'feature',
  'fix',
  'bug',
  'docs',
  'internal',
  'mobile',
  'performance',
  'component: accordion',
  'component: autocomplete',
  'component: combobox',
  'component: dialog',
  'component: popover',
  'component: select',
  'component: tooltip',
]

const cities = [
  'Amsterdam',
  'Barcelona',
  'Berlin',
  'Bogotá',
  'Buenos Aires',
  'Kraków',
  'Lisbon',
  'London',
  'Montréal',
  'New York',
  'Paris',
  'São Paulo',
  'Tokyo',
  'Zürich',
]

export const AutocompleteDemo = clientEntry(
  import.meta.url,
  function AutocompleteDemo(_handle: Handle) {
    return () => (
      <div class="flex w-full max-w-sm flex-col gap-8">
        <div class="flex flex-col gap-2">
          <Label for="autocomplete-demo-tags">Search tags (inline completion)</Label>
          <Autocomplete items={tags} mode="both" autoHighlight>
            <AutocompleteInput
              id="autocomplete-demo-tags"
              class="w-72"
              placeholder="e.g. feature"
              showSearchIcon
              showClear
            />
            <AutocompleteContent>
              <AutocompleteEmpty>No tags found.</AutocompleteEmpty>
              <AutocompleteList>
                {(tag: string) => (
                  <AutocompleteItem key={tag} value={tag}>
                    {tag}
                  </AutocompleteItem>
                )}
              </AutocompleteList>
            </AutocompleteContent>
          </Autocomplete>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="autocomplete-demo-city">City (free text with suggestions)</Label>
          <Autocomplete items={cities} name="city">
            <AutocompleteInput
              id="autocomplete-demo-city"
              class="w-72"
              placeholder="Type any city"
              showTrigger
            />
            <p class="text-xs text-muted-foreground">
              Value:{' '}
              <AutocompleteValue>{(value) => (value ? `“${value}”` : '(empty)')}</AutocompleteValue>
            </p>
            <AutocompleteContent>
              <AutocompleteEmpty>No suggestions. Your text is kept.</AutocompleteEmpty>
              <AutocompleteList>
                {(city: string) => (
                  <AutocompleteItem key={city} value={city}>
                    {city}
                  </AutocompleteItem>
                )}
              </AutocompleteList>
            </AutocompleteContent>
          </Autocomplete>
        </div>
      </div>
    )
  },
)

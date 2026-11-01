import { clientEntry, type Handle } from 'remix/component'
import * as checkboxGroup from 'stems-ui/checkbox-group'
import { Checkbox } from '@stemsui/registry/ui/checkbox.tsx'

const apples = [
  { value: 'fuji', label: 'Fuji' },
  { value: 'gala', label: 'Gala' },
  { value: 'granny-smith', label: 'Granny Smith' },
]

const permissions = [
  { value: 'read', label: 'Read' },
  { value: 'write', label: 'Write' },
  { value: 'admin', label: 'Admin (locked)', disabled: true },
]

export const CheckboxGroupDemo = clientEntry(
  import.meta.url,
  function CheckboxGroupDemo(handle: Handle) {
    let selected: string[] = ['gala']

    return () => (
      <div class="flex w-full max-w-sm flex-col gap-8">
        <checkboxGroup.Context
          value={selected}
          allValues={apples.map((apple) => apple.value)}
          onValueChange={(value) => {
            selected = value
            void handle.update()
          }}
        >
          <div
            class="flex flex-col gap-3"
            aria-labelledby="apples-label"
            mix={checkboxGroup.root()}
          >
            <label
              id="apples-label"
              class="flex items-center gap-3 text-sm font-medium select-none"
            >
              <Checkbox parent />
              All apples
            </label>
            {apples.map((apple) => (
              <label class="ml-7 flex items-center gap-3 text-sm select-none">
                <Checkbox name="apple" value={apple.value} />
                {apple.label}
              </label>
            ))}
          </div>
        </checkboxGroup.Context>
        <p class="-mt-4 text-sm text-muted-foreground" data-testid="checkbox-group-value">
          Selected:{' '}
          <code class="font-mono text-foreground">
            {selected.length ? selected.join(', ') : '(none)'}
          </code>
        </p>

        <checkboxGroup.Context defaultValue={['read', 'admin']}>
          <div
            class="flex flex-col gap-3"
            aria-labelledby="permissions-label"
            mix={checkboxGroup.root()}
          >
            <div id="permissions-label" class="text-sm font-medium">
              Permissions (uncontrolled)
            </div>
            {permissions.map((permission) => (
              <label class="flex items-center gap-3 text-sm select-none has-data-disabled:text-muted-foreground">
                <Checkbox
                  name="permission"
                  value={permission.value}
                  disabled={permission.disabled}
                />
                {permission.label}
              </label>
            ))}
          </div>
        </checkboxGroup.Context>
      </div>
    )
  },
)

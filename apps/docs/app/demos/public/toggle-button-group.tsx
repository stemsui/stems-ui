import { clientEntry, type Handle } from 'remix/component'
import {
  ToggleButtonGroup,
  ToggleButtonGroupItem,
} from '@stemsui/registry/ui/toggle-button-group.tsx'

function Icon(handle: Handle<{ paths: string[] }>) {
  return () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {handle.props.paths.map((d) => (
        <path d={d} />
      ))}
    </svg>
  )
}

const bold = ['M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8']
const italic = ['M19 4h-9', 'M14 20H5', 'M15 4 9 20']
const underline = ['M6 4v6a6 6 0 0 0 12 0V4', 'M4 20h16']
const alignLeft = ['M21 5H3', 'M15 12H3', 'M17 19H3']
const alignCenter = ['M21 5H3', 'M17 12H7', 'M19 19H5']
const alignRight = ['M21 5H3', 'M21 12H9', 'M21 19H7']

export const ToggleButtonGroupDemo = clientEntry(
  import.meta.url,
  function ToggleButtonGroupDemo(handle: Handle) {
    let formatting: string[] = ['bold']
    let alignment: string[] = ['left']

    return () => (
      <div class="flex flex-col items-center gap-6">
        <div class="flex flex-col items-center gap-2">
          <ToggleButtonGroup
            aria-label="Text formatting"
            multiple
            variant="outline"
            value={formatting}
            onValueChange={(value) => {
              formatting = value
              void handle.update()
            }}
          >
            <ToggleButtonGroupItem value="bold" aria-label="Toggle bold">
              <Icon paths={bold} />
            </ToggleButtonGroupItem>
            <ToggleButtonGroupItem value="italic" aria-label="Toggle italic">
              <Icon paths={italic} />
            </ToggleButtonGroupItem>
            <ToggleButtonGroupItem value="underline" aria-label="Toggle underline">
              <Icon paths={underline} />
            </ToggleButtonGroupItem>
          </ToggleButtonGroup>
          <p class="text-sm text-muted-foreground" data-testid="formatting-value">
            Formatting:{' '}
            <code class="font-mono text-foreground">
              {formatting.length ? formatting.join(', ') : '(none)'}
            </code>
          </p>
        </div>

        <div class="flex flex-col items-center gap-2">
          <ToggleButtonGroup
            aria-label="Text alignment"
            variant="outline"
            spacing={0}
            value={alignment}
            onValueChange={(value) => {
              alignment = value
              void handle.update()
            }}
          >
            <ToggleButtonGroupItem value="left" aria-label="Align left">
              <Icon paths={alignLeft} />
            </ToggleButtonGroupItem>
            <ToggleButtonGroupItem value="center" aria-label="Align center">
              <Icon paths={alignCenter} />
            </ToggleButtonGroupItem>
            <ToggleButtonGroupItem value="right" aria-label="Align right">
              <Icon paths={alignRight} />
            </ToggleButtonGroupItem>
          </ToggleButtonGroup>
          <p class="text-sm text-muted-foreground" data-testid="alignment-value">
            Alignment: <code class="font-mono text-foreground">{alignment[0] ?? '(none)'}</code>
          </p>
        </div>

        <ToggleButtonGroup
          aria-label="View"
          orientation="vertical"
          size="sm"
          defaultValue={['list']}
        >
          <ToggleButtonGroupItem value="list">List</ToggleButtonGroupItem>
          <ToggleButtonGroupItem value="grid">Grid</ToggleButtonGroupItem>
          <ToggleButtonGroupItem value="board" disabled>
            Board
          </ToggleButtonGroupItem>
        </ToggleButtonGroup>
      </div>
    )
  },
)

import { clientEntry, type Handle } from 'remix/component'
import * as popover from 'stems-ui/popover'
import { buttonVariants } from '@stemsui/registry/ui/button.tsx'
import { Input } from '@stemsui/registry/ui/input.tsx'
import { Label } from '@stemsui/registry/ui/label.tsx'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@stemsui/registry/ui/popover.tsx'

const dimensions = [
  { id: 'width', label: 'Width', value: '100%' },
  { id: 'max-width', label: 'Max. width', value: '300px' },
  { id: 'height', label: 'Height', value: '25px' },
  { id: 'max-height', label: 'Max. height', value: 'none' },
] as const

const sides = ['top', 'right', 'bottom', 'left'] as const

export const PopoverDemo = clientEntry(import.meta.url, function PopoverDemo(handle: Handle) {
  let lastChange = 'none'

  return () => (
    <div class="flex flex-col items-center gap-10">
      <Popover
        onOpenChange={(open, details) => {
          lastChange = `${open ? 'opened' : 'closed'} (${details.reason})`
          void handle.update()
        }}
      >
        <PopoverTrigger class={buttonVariants({ variant: 'outline' })} data-testid="dimensions">
          Open popover
        </PopoverTrigger>
        <PopoverContent class="w-80">
          <PopoverHeader>
            <PopoverTitle>Dimensions</PopoverTitle>
            <PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
          </PopoverHeader>
          <div class="grid gap-2">
            {dimensions.map((field) => (
              <div class="grid grid-cols-3 items-center gap-4">
                <Label for={`popover-demo-${field.id}`}>{field.label}</Label>
                <Input
                  id={`popover-demo-${field.id}`}
                  defaultValue={field.value}
                  class="col-span-2 h-8"
                />
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <div class="flex flex-wrap justify-center gap-2">
        {sides.map((side) => (
          <Popover>
            <PopoverTrigger
              class={buttonVariants({ variant: 'outline', size: 'sm' })}
              data-testid={`side-${side}`}
            >
              {side}
            </PopoverTrigger>
            <PopoverContent side={side} class="w-56">
              <PopoverHeader>
                <PopoverTitle>Side: {side}</PopoverTitle>
                <PopoverDescription>
                  Flips to the opposite side when there isn't room.
                </PopoverDescription>
              </PopoverHeader>
            </PopoverContent>
          </Popover>
        ))}
      </div>

      <Popover>
        <PopoverTrigger class={buttonVariants({ variant: 'secondary' })} data-testid="nested">
          Nested popovers
        </PopoverTrigger>
        <PopoverContent align="start" class="w-64">
          <PopoverHeader>
            <PopoverTitle>Workspace</PopoverTitle>
            <PopoverDescription>Escape closes the innermost popover first.</PopoverDescription>
          </PopoverHeader>
          <Popover>
            <PopoverTrigger
              class={buttonVariants({ variant: 'outline', size: 'sm' })}
              data-testid="nested-inner"
            >
              Members
            </PopoverTrigger>
            <PopoverContent side="right" align="start" class="w-56">
              <PopoverHeader>
                <PopoverTitle>Members</PopoverTitle>
                <PopoverDescription>3 people have access.</PopoverDescription>
              </PopoverHeader>
              <button type="button" class={buttonVariants({ size: 'sm' })}>
                Invite
              </button>
            </PopoverContent>
          </Popover>
        </PopoverContent>
      </Popover>

      <p class="text-sm text-muted-foreground" data-testid="popover-result">
        Last change: <span class="font-medium text-foreground">{lastChange}</span>
      </p>

      <DetachedTriggers />
    </div>
  )
})

interface Person {
  name: string
  role: string
  email: string
}

const people: Person[] = [
  { name: 'Ada Lovelace', role: 'Analyst', email: 'ada@example.com' },
  { name: 'Grace Hopper', role: 'Compiler lead', email: 'grace@example.com' },
  { name: 'Alan Turing', role: 'Researcher', email: 'alan@example.com' },
]

/**
 * Detached triggers: the triggers live outside the `Popover`, linked by a handle. Each passes a
 * `payload`; the one popover shows the active trigger's person and anchors to that trigger.
 */
function DetachedTriggers() {
  let people$ = popover.createHandle<Person>()

  return () => (
    <div class="flex flex-col items-center gap-3" data-testid="detached">
      <p class="text-sm text-muted-foreground">Detached triggers sharing one popover</p>
      <div class="flex flex-wrap justify-center gap-2">
        {people.map((person, index) => (
          <PopoverTrigger
            id={`detached-person-${index}`}
            class={buttonVariants({ variant: 'outline', size: 'sm' })}
            data-testid={`detached-${index}`}
            handle={people$}
            payload={person}
          >
            {person.name.split(' ')[0]}
          </PopoverTrigger>
        ))}
      </div>

      <Popover handle={people$}>
        {({ payload }) => (
          <PopoverContent class="w-64" data-testid="detached-content">
            <PopoverHeader>
              <PopoverTitle>{payload?.name ?? 'Someone'}</PopoverTitle>
              <PopoverDescription>{payload?.role}</PopoverDescription>
            </PopoverHeader>
            <a
              class={buttonVariants({ variant: 'secondary', size: 'sm' })}
              href={`mailto:${payload?.email ?? ''}`}
            >
              Email {payload?.name.split(' ')[0]}
            </a>
          </PopoverContent>
        )}
      </Popover>
    </div>
  )
}

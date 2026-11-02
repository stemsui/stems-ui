import { clientEntry, type Handle, type RemixNode } from 'remix/component'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@stemsui/registry/ui/navigation-menu.tsx'

const components = [
  {
    title: 'Alert Dialog',
    href: '/components/alert-dialog',
    description: 'A modal dialog that interrupts the user with important content.',
  },
  {
    title: 'Preview Card',
    href: '/components/preview-card',
    description: 'For sighted users to preview content available behind a link.',
  },
  {
    title: 'Progress',
    href: '/components/progress',
    description: 'Displays an indicator showing the completion progress of a task.',
  },
  {
    title: 'Scroll Area',
    href: '/components/scroll-area',
    description: 'Visually or semantically separates content.',
  },
  {
    title: 'Tabs',
    href: '/components/tabs',
    description: 'Layered sections of content, displayed one at a time.',
  },
  {
    title: 'Tooltip',
    href: '/components/tooltip',
    description: 'A popup that displays information related to an element on hover or focus.',
  },
] as const

function ListItem(handle: Handle<{ title: string; href: string; children?: RemixNode }>) {
  return () => (
    <li>
      <NavigationMenuLink href={handle.props.href} class="flex-col items-start gap-1">
        <div class="text-sm leading-none font-medium">{handle.props.title}</div>
        <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
          {handle.props.children}
        </p>
      </NavigationMenuLink>
    </li>
  )
}

export const NavigationMenuDemo = clientEntry(
  import.meta.url,
  function NavigationMenuDemo(handle: Handle) {
    let lastChange = 'none'

    return () => (
      <div class="flex min-h-80 w-full flex-col items-center gap-4">
        <p class="text-sm text-muted-foreground" data-testid="navigation-menu-result">
          Last change: <span class="font-medium text-foreground">{lastChange}</span>
        </p>
        <NavigationMenu
          class="flex-none"
          onValueChange={(value, details) => {
            lastChange = `${value ?? 'closed'} (${details.reason})`
            void handle.update()
          }}
        >
          <NavigationMenuList>
            <NavigationMenuItem value="getting-started">
              <NavigationMenuTrigger data-testid="getting-started">
                Getting started
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul class="grid w-96 gap-1 p-1 md:w-[28rem] md:grid-cols-[.75fr_1fr]">
                  <li class="row-span-3">
                    <NavigationMenuLink
                      href="/"
                      class="flex h-full w-full flex-col items-start justify-end rounded-md bg-linear-to-b from-muted/50 to-muted p-4 no-underline outline-hidden select-none focus:shadow-md md:p-6"
                    >
                      <div class="mb-2 text-lg font-medium sm:mt-4">Stems UI</div>
                      <p class="text-sm leading-tight text-muted-foreground">
                        Headless primitives and shadcn-styled components for Remix 3.
                      </p>
                    </NavigationMenuLink>
                  </li>
                  <ListItem href="/" title="Introduction">
                    Behavior from stems-ui, styles you own.
                  </ListItem>
                  <ListItem href="/" title="Installation">
                    Add components with the shadcn CLI.
                  </ListItem>
                  <ListItem href="/components/tabs" title="Composition">
                    Mix behavior onto your own elements.
                  </ListItem>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem value="components">
              <NavigationMenuTrigger data-testid="components">Components</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul class="grid w-96 gap-1 p-1 md:w-[32rem] md:grid-cols-2 lg:w-[38rem]">
                  {components.map((component) => (
                    <ListItem title={component.title} href={component.href}>
                      {component.description}
                    </ListItem>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                href="/components/navigation-menu"
                active
                class={navigationMenuTriggerStyle()}
                data-testid="docs"
              >
                Docs
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    )
  },
)

import { Separator } from '@stemsui/registry/ui/separator.tsx'

import { Document } from './document.tsx'
import { MenuDemo } from './public/menu-demo.tsx'

export function HomePage() {
  return () => (
    <Document>
      <main class="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
        <header class="flex flex-col gap-2">
          <h1 class="text-3xl font-semibold tracking-tight">Stems UI</h1>
          <p class="text-muted-foreground">
            Accessible components for Remix 3. Built on <code>@remix-run/ui</code>, styled like
            shadcn/ui.
          </p>
        </header>

        <Separator />

        <section class="flex flex-col gap-4" aria-labelledby="dropdown-menu-heading">
          <div class="flex flex-col gap-1">
            <h2 id="dropdown-menu-heading" class="text-xl font-semibold">
              Dropdown Menu
            </h2>
            <p class="text-sm text-muted-foreground">
              Behavior from <code>@remix-run/ui/menu</code>. Styles from the Stems registry.
            </p>
          </div>
          <div class="flex min-h-48 items-start justify-center rounded-lg border p-8">
            <MenuDemo />
          </div>
        </section>
      </main>
    </Document>
  )
}

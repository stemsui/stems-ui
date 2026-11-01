import { Separator } from '@stemsui/registry/ui/separator.tsx'

import { demos } from '../demos/index.ts'
import { routes } from '../routes.ts'
import { Layout } from './layout.tsx'

export function HomePage() {
  return () => (
    <Layout>
      <div class="flex flex-col gap-8">
        <header class="flex flex-col gap-2">
          <h1 class="text-3xl font-semibold tracking-tight">Stems UI</h1>
          <p class="text-muted-foreground">
            Accessible, headless components for Remix 3, with shadcn/ui-style styled versions you
            copy into your app.
          </p>
        </header>

        <Separator />

        <ul class="grid gap-3 sm:grid-cols-2">
          {Object.entries(demos)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, demo]) => (
              <li key={name}>
                <a
                  href={routes.component.href({ name })}
                  class="block h-full rounded-lg border p-4 hover:bg-accent"
                >
                  <span class="font-medium">{demo.title}</span>
                  <span class="mt-1 block text-sm text-muted-foreground">{demo.description}</span>
                </a>
              </li>
            ))}
        </ul>
      </div>
    </Layout>
  )
}

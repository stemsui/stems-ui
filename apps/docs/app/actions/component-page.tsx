import type { Handle } from 'remix/component'

import { demos } from '../demos/index.ts'
import { Layout } from './layout.tsx'

export function ComponentPage(handle: Handle<{ name: string }>) {
  return () => {
    let { name } = handle.props
    let { title, description, behavior, Demo } = demos[name]!

    return (
      <Layout title={title} current={name}>
        <article class="flex flex-col gap-6">
          <header class="flex flex-col gap-2">
            <h1 class="text-3xl font-semibold tracking-tight">{title}</h1>
            <p class="text-muted-foreground">{description}</p>
          </header>

          <section
            aria-label="Demo"
            data-testid="demo"
            class="flex min-h-56 items-center justify-center rounded-lg border p-10"
          >
            <Demo />
          </section>

          <section class="flex flex-col gap-2 text-sm">
            <h2 class="text-lg font-semibold">Installation</h2>
            <pre class="overflow-x-auto rounded-md bg-muted px-4 py-3 font-mono text-xs">
              <code>npx shadcn add @stemsui/{name}</code>
            </pre>
            <p class="text-muted-foreground">
              Behavior: {behavior.length === 0 ? 'none (styling only)' : null}
              {behavior.map((module, index) => (
                <>
                  {index > 0 ? ', ' : null}
                  <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">{module}</code>
                </>
              ))}
            </p>
          </section>
        </article>
      </Layout>
    )
  }
}

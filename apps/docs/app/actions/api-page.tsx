import { unsafeHTML, type Handle } from 'remix/component'

import type { ModuleReference } from '../content.ts'
import { Layout } from './layout.tsx'

/** Reference for a headless module without a component page (e.g. `stems-ui/separator`). */
export function ApiPage(handle: Handle<{ reference: ModuleReference }>) {
  return () => {
    let { reference } = handle.props
    let name = reference.module.replace('stems-ui/', '')
    let toc = reference.toc.filter((entry) => entry.depth === 2 || entry.depth === 3)

    return (
      <Layout title={reference.module} current={`api:${name}`} toc={toc}>
        <article class="flex flex-col gap-6" data-testid="reference">
          <header class="flex flex-col gap-2">
            <p class="text-sm font-medium text-muted-foreground">Headless module</p>
            <h1 class="font-mono text-3xl font-semibold tracking-tight">{reference.module}</h1>
          </header>
          <div
            class="prose-docs"
            data-module={reference.module}
            innerHTML={unsafeHTML(reference.html)}
          />
        </article>
      </Layout>
    )
  }
}

import { unsafeHTML, type Handle } from 'remix/component'

import type { ModuleReference, RenderedMarkdown, TocEntry } from '../content.ts'
import { demos } from '../demos/index.ts'
import { highlightCode } from '../highlight.ts'
import { routes } from '../routes.ts'
import { CopyButton } from '../ui/public/copy-button.tsx'
import { Layout } from './layout.tsx'

export interface ComponentPageProps {
  name: string
  /** Rendered READMEs of the page's behavior modules. */
  references: ModuleReference[]
  /** Source of `app/demos/public/<name>.tsx`. */
  source: string
  documentation?: RenderedMarkdown
}

export function ComponentPage(handle: Handle<ComponentPageProps>) {
  return () => {
    let { name, references, source, documentation } = handle.props
    let {
      title,
      description,
      behavior,
      behaviorDescription,
      Demo,
      registryItem = name,
    } = demos[name]!
    let install = `npx shadcn add @stemsui/${registryItem}`

    let toc: TocEntry[] = [
      { depth: 2, id: 'installation', html: 'Installation' },
      ...(documentation?.toc ?? []),
      ...(references.length > 0
        ? [
            { depth: 2, id: 'api-reference', html: 'API reference' },
            ...references.flatMap((reference) => reference.toc.filter((entry) => entry.depth <= 4)),
          ]
        : []),
    ]

    return (
      <Layout title={title} current={`component:${name}`} toc={toc}>
        <article class="flex flex-col gap-8">
          <header class="flex flex-col gap-2">
            <h1 class="text-3xl font-semibold tracking-tight">{title}</h1>
            <p class="text-lg text-muted-foreground">{description}</p>
          </header>

          <div class="flex flex-col gap-0">
            <section
              aria-label="Demo"
              data-testid="demo"
              class="flex min-h-56 items-center justify-center rounded-t-lg border p-10"
            >
              <Demo />
            </section>
            <details id="code" class="group rounded-b-lg border border-t-0" data-testid="demo-code">
              <summary class="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  class="size-4 transition-transform group-open:rotate-90"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
                Code
                <span class="ml-auto font-mono text-xs font-normal">
                  app/demos/public/{name}.tsx
                </span>
              </summary>
              <div class="relative border-t">
                <CopyButton target="demo-source" label="Copy code" class="absolute top-2 right-2" />
                <pre
                  class="th-code max-h-[32rem] overflow-auto bg-muted/50 p-4 font-mono text-[0.8125rem] leading-relaxed"
                  data-lang="tsx"
                >
                  <code id="demo-source" innerHTML={unsafeHTML(highlightCode(source, 'tsx'))} />
                </pre>
              </div>
            </details>
          </div>

          <section aria-labelledby="installation" class="flex flex-col gap-3">
            <h2 id="installation" class="scroll-mt-20 text-2xl font-semibold tracking-tight">
              Installation
            </h2>
            <div class="flex items-center gap-2 rounded-lg border bg-muted/50 py-1.5 pr-1.5 pl-4">
              <code class="min-w-0 flex-1 overflow-x-auto font-mono text-sm whitespace-nowrap">
                {install}
              </code>
              <CopyButton text={install} label="Copy install command" />
            </div>
            <p class="text-sm text-muted-foreground">
              Requires the one-time{' '}
              <a
                href={routes.guide.href({ slug: 'installation' })}
                class="font-medium text-foreground underline underline-offset-4"
              >
                setup
              </a>
              . Behavior:{' '}
              {behaviorDescription ?? (behavior.length === 0 ? 'none (styling only)' : null)}
              {behavior.map((module, index) => (
                <>
                  {index > 0 ? ', ' : null}
                  <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs whitespace-nowrap">
                    {module}
                  </code>
                </>
              ))}
              .
            </p>
          </section>

          {documentation ? (
            <div
              class="prose-docs"
              data-testid="component-documentation"
              innerHTML={unsafeHTML(documentation.html)}
            />
          ) : null}

          {references.length > 0 ? (
            <section
              aria-labelledby="api-reference"
              class="flex flex-col gap-4"
              data-testid="reference"
            >
              <h2 id="api-reference" class="scroll-mt-20 text-2xl font-semibold tracking-tight">
                API reference
              </h2>
              <p class="text-sm text-muted-foreground">
                The styled component is built on the headless{' '}
                {references.length === 1 ? 'module' : 'modules'} below: its props mirror these
                options, and the same events and data attributes apply.
              </p>
              {references.map((reference) => (
                <div
                  key={reference.module}
                  class="prose-docs"
                  data-module={reference.module}
                  innerHTML={unsafeHTML(reference.html)}
                />
              ))}
            </section>
          ) : null}
        </article>
      </Layout>
    )
  }
}

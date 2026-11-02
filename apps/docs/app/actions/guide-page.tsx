import { unsafeHTML, type Handle } from 'remix/component'

import type { RenderedMarkdown } from '../content.ts'
import { guides } from '../content.ts'
import { Layout } from './layout.tsx'

export interface GuidePageProps {
  slug: string
  /** The guide's markdown, rendered without its `#` title. */
  content: RenderedMarkdown
}

export function GuidePage(handle: Handle<GuidePageProps>) {
  return () => {
    let { slug, content } = handle.props
    let guide = guides[slug]!
    let toc = content.toc.filter((entry) => entry.depth === 2 || entry.depth === 3)

    return (
      <Layout title={guide.title} current={`guide:${slug}`} toc={toc}>
        <article class="flex flex-col gap-6" data-testid="guide">
          <header class="flex flex-col gap-2">
            <h1 class="text-3xl font-semibold tracking-tight">{guide.title}</h1>
            <p class="text-lg text-muted-foreground">{guide.description}</p>
          </header>
          <div class="prose-docs" innerHTML={unsafeHTML(content.html)} />
        </article>
      </Layout>
    )
  }
}

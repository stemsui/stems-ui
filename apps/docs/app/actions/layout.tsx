import { unsafeHTML, type Handle, type RemixNode } from 'remix/component'

import type { TocEntry } from '../content.ts'
import { guides, headlessOnlyModules } from '../content.ts'
import { demos } from '../demos/index.ts'
import { routes } from '../routes.ts'
import { ThemeToggle } from '../ui/public/theme-toggle.tsx'
import { Document } from './document.tsx'

export interface LayoutProps {
  title?: string
  /** The current page, e.g. `component:tabs` or `guide:theming`. */
  current?: string
  /** On-page table of contents, shown in a right column on wide screens. */
  toc?: TocEntry[]
  children?: RemixNode
}

const navLinkClass =
  'block rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground'

const githubUrl = 'https://github.com/stemsui/stems-ui'

function GitHubIcon() {
  return () => (
    <svg aria-hidden="true" viewBox="0 0 24 24" class="size-4 shrink-0" fill="currentColor">
      <path d="M12 .75a11.25 11.25 0 0 0-3.558 21.922c.563.104.768-.244.768-.542 0-.267-.01-.975-.015-1.914-3.13.68-3.79-1.508-3.79-1.508-.511-1.3-1.249-1.646-1.249-1.646-1.021-.699.078-.685.078-.685 1.13.08 1.724 1.16 1.724 1.16 1.004 1.72 2.633 1.223 3.274.935.102-.727.393-1.223.715-1.504-2.499-.284-5.126-1.25-5.126-5.565 0-1.23.44-2.235 1.16-3.023-.117-.285-.503-1.43.11-2.98 0 0 .945-.303 3.095 1.155a10.792 10.792 0 0 1 5.628 0c2.149-1.458 3.092-1.155 3.092-1.155.615 1.55.229 2.695.112 2.98.722.788 1.158 1.793 1.158 3.023 0 4.327-2.63 5.278-5.137 5.557.404.35.765 1.042.765 2.1 0 1.516-.014 2.74-.014 3.112 0 .3.203.65.774.54A11.25 11.25 0 0 0 12 .75Z" />
    </svg>
  )
}

function SidebarNav(handle: Handle<{ current?: string }>) {
  return () => {
    let { current } = handle.props
    let names = Object.keys(demos).sort()
    return (
      <div class="flex flex-col gap-6">
        <div>
          <p class="mb-2 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Guides
          </p>
          <ul class="flex flex-col gap-0.5">
            {Object.entries(guides).map(([slug, guide]) => (
              <li key={slug}>
                <a
                  href={routes.guide.href({ slug })}
                  aria-current={current === `guide:${slug}` ? 'page' : undefined}
                  class={navLinkClass}
                >
                  {guide.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p class="mb-2 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Components
          </p>
          <ul class="flex flex-col gap-0.5">
            {names.map((name) => (
              <li key={name}>
                <a
                  href={routes.component.href({ name })}
                  aria-current={current === `component:${name}` ? 'page' : undefined}
                  class={navLinkClass}
                >
                  {demos[name]!.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p class="mb-2 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Headless only
          </p>
          <ul class="flex flex-col gap-0.5">
            {headlessOnlyModules.map((module) => (
              <li key={module}>
                <a
                  href={routes.api.href({ module })}
                  aria-current={current === `api:${module}` ? 'page' : undefined}
                  class={`${navLinkClass} font-mono text-xs`}
                >
                  stems-ui/{module}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }
}

function TableOfContents(handle: Handle<{ toc: TocEntry[] }>) {
  return () => (
    <nav aria-label="On this page" class="flex flex-col gap-2 text-sm">
      <p class="font-medium">On this page</p>
      <ul class="flex flex-col gap-1.5">
        {handle.props.toc.map((entry) => (
          <li
            key={entry.id}
            class="data-[depth=3]:pl-3 data-[depth=4]:pl-6"
            data-depth={entry.depth}
          >
            <a
              href={`#${entry.id}`}
              class="toc-link block text-muted-foreground hover:text-foreground"
              innerHTML={unsafeInline(entry.html)}
            />
          </li>
        ))}
      </ul>
    </nav>
  )
}

// Heading HTML comes from repo markdown rendered by marked (trusted). Strip the anchor links.
function unsafeInline(html: string) {
  return unsafeHTML(html.replace(/<\/?a\b[^>]*>/g, ''))
}

export function Layout(handle: Handle<LayoutProps>) {
  return () => {
    let { title, current, toc, children } = handle.props
    let hasToc = toc !== undefined && toc.length > 0

    return (
      <Document title={title ? `${title} · Stems UI` : 'Stems UI — Accessible UI for Remix 3'}>
        <header class="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div class="mx-auto flex h-14 max-w-7xl items-center gap-4 px-6">
            <a
              href={routes.home.href()}
              class="flex items-center gap-2 text-base font-semibold tracking-tight"
            >
              <img src="/logo.svg" alt="" width="24" height="24" class="size-6" />
              Stems UI
            </a>
            <nav aria-label="Main" class="hidden items-center gap-4 text-sm sm:flex">
              <a
                href={routes.guide.href({ slug: 'installation' })}
                class="text-muted-foreground hover:text-foreground"
              >
                Docs
              </a>
              <a
                href={`${routes.home.href()}#components`}
                class="text-muted-foreground hover:text-foreground"
              >
                Components
              </a>
            </nav>
            <div class="ml-auto flex items-center gap-1">
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub repository"
                title="GitHub repository"
                class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <GitHubIcon />
              </a>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div class="mx-auto flex max-w-7xl gap-10 px-6 py-8">
          <aside class="hidden w-52 shrink-0 md:block">
            <nav
              aria-label="Documentation"
              class="sticky top-22 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 pb-8"
            >
              <SidebarNav current={current} />
            </nav>
          </aside>

          <main class="min-w-0 flex-1">
            {/* Small screens: the sidebar collapses into a disclosure. */}
            <details class="mb-6 rounded-lg border md:hidden">
              <summary class="cursor-pointer px-4 py-2 text-sm font-medium">Menu</summary>
              <nav aria-label="Mobile" class="border-t p-2">
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  class="mb-4 flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <GitHubIcon />
                  GitHub
                </a>
                <SidebarNav current={current} />
              </nav>
            </details>
            {children}
          </main>

          {hasToc ? (
            <aside class="hidden w-52 shrink-0 xl:block">
              <div class="sticky top-22 max-h-[calc(100vh-7rem)] overflow-y-auto pb-8">
                <TableOfContents toc={toc!} />
              </div>
            </aside>
          ) : null}
        </div>
      </Document>
    )
  }
}

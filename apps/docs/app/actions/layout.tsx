import type { Handle, RemixNode } from 'remix/component'

import { demos } from '../demos/index.ts'
import { routes } from '../routes.ts'
import { Document } from './document.tsx'

export function Layout(handle: Handle<{ title?: string; current?: string; children?: RemixNode }>) {
  return () => {
    let { title, current, children } = handle.props
    let names = Object.keys(demos).sort()

    return (
      <Document title={title ? `${title} · Stems UI` : 'Stems UI'}>
        <div class="mx-auto flex max-w-5xl gap-10 px-6 py-10">
          <nav aria-label="Components" class="hidden w-48 shrink-0 sm:block">
            <a href={routes.home.href()} class="mb-6 block text-lg font-semibold tracking-tight">
              Stems UI
            </a>
            <p class="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Components
            </p>
            <ul class="flex flex-col gap-0.5">
              {names.map((name) => (
                <li key={name}>
                  <a
                    href={routes.component.href({ name })}
                    aria-current={name === current ? 'page' : undefined}
                    class="block rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground"
                  >
                    {demos[name]!.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <main class="min-w-0 flex-1">{children}</main>
        </div>
      </Document>
    )
  }
}

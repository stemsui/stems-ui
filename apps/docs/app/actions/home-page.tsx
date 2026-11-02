import { demos } from '../demos/index.ts'
import { routes } from '../routes.ts'
import { CopyButton } from '../ui/public/copy-button.tsx'
import { Layout } from './layout.tsx'

const addCommand = 'npx shadcn add @stemsui/theme @stemsui/dropdown-menu'

const linkClass = 'font-medium text-foreground underline underline-offset-4'

export function HomePage() {
  return () => (
    <Layout>
      <div class="flex flex-col gap-12">
        <header class="flex flex-col gap-4 pt-4">
          <h1 class="text-4xl font-semibold tracking-tight">Accessible UI for Remix 3</h1>
          <p class="max-w-2xl text-lg text-muted-foreground">
            Stems is two things: <code class="font-mono text-base text-foreground">stems-ui</code>,
            headless primitives written the Remix 3 way (mixins,{' '}
            <code class="font-mono">Context</code>, bubbling events, native-first markup), and a
            shadcn-compatible registry of styled components built on them that you copy into your
            app and own.
          </p>
          <div class="flex flex-wrap gap-3">
            <a
              href={routes.guide.href({ slug: 'installation' })}
              class="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
            >
              Get started
            </a>
            <a
              href="#components"
              class="inline-flex h-9 items-center rounded-md border bg-background px-4 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground"
            >
              Browse components
            </a>
          </div>
        </header>

        <section aria-labelledby="quick-start" class="flex flex-col gap-4">
          <h2 id="quick-start" class="text-2xl font-semibold tracking-tight">
            Quick start
          </h2>
          <ol class="grid gap-4 md:grid-cols-3">
            <li class="flex flex-col gap-2 rounded-lg border p-4">
              <span class="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                1
              </span>
              <span class="font-medium">Set up your app</span>
              <span class="text-sm text-muted-foreground">
                Add an <code class="font-mono">#app/*</code> import alias, Tailwind CSS v4, and a{' '}
                <code class="font-mono">components.json</code>. See{' '}
                <a href={routes.guide.href({ slug: 'installation' })} class={linkClass}>
                  Installation
                </a>
                .
              </span>
            </li>
            <li class="flex flex-col gap-2 rounded-lg border p-4">
              <span class="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                2
              </span>
              <span class="font-medium">Add the theme and components</span>
              <div class="flex items-center gap-1 rounded-md bg-muted/60 py-1 pr-1 pl-2">
                <code class="min-w-0 flex-1 font-mono text-xs leading-5">{addCommand}</code>
                <CopyButton text={addCommand} label="Copy command" />
              </div>
            </li>
            <li class="flex flex-col gap-2 rounded-lg border p-4">
              <span class="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                3
              </span>
              <span class="font-medium">Render inside a client entry</span>
              <span class="text-sm text-muted-foreground">
                Interactive components run in a <code class="font-mono">clientEntry(...)</code>{' '}
                boundary. Make them yours with{' '}
                <a href={routes.guide.href({ slug: 'theming' })} class={linkClass}>
                  theming
                </a>
                , or go{' '}
                <a href={routes.guide.href({ slug: 'headless' })} class={linkClass}>
                  headless
                </a>
                .
              </span>
            </li>
          </ol>
        </section>

        <section aria-labelledby="components" class="flex flex-col gap-4">
          <h2 id="components" class="scroll-mt-20 text-2xl font-semibold tracking-tight">
            Components
          </h2>
          <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(demos)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([name, demo]) => (
                <li key={name}>
                  <a
                    href={routes.component.href({ name })}
                    class="block h-full rounded-lg border p-4 transition-colors hover:bg-accent"
                  >
                    <span class="font-medium">{demo.title}</span>
                    <span class="mt-1 block text-sm text-muted-foreground">{demo.description}</span>
                  </a>
                </li>
              ))}
          </ul>
        </section>
      </div>
    </Layout>
  )
}

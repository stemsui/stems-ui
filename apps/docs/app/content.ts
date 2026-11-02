import { readdirSync, existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { Marked, type Tokens } from 'marked'

import { rootDir } from './assets.ts'
import { demos } from './demos/index.ts'
import { highlightCode } from './highlight.ts'

/** The monorepo root (`apps/docs/../..`). */
export const repoRoot = path.resolve(rootDir, '../..')

const isProduction = process.env.NODE_ENV === 'production'

// Files are read at request time in development (so edits show up on reload) and cached in
// production. The cache key is the absolute path plus the render options.
let cache = new Map<string, Promise<unknown>>()

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!isProduction) return load()
  let hit = cache.get(key) as Promise<T> | undefined
  if (!hit) {
    hit = load()
    // Don't cache failures (e.g. a README that doesn't exist yet).
    hit.catch(() => cache.delete(key))
    cache.set(key, hit)
  }
  return hit
}

export interface TocEntry {
  depth: number
  id: string
  /** Inline HTML of the heading (keeps `code` formatting). */
  html: string
}

export interface RenderedMarkdown {
  html: string
  toc: TocEntry[]
  /** Text of the document's first `#` heading, if any. */
  title?: string
}

export interface RenderOptions {
  /** Prefix for heading ids, so several documents can share a page. */
  idPrefix?: string
  /** Added to every heading depth (`1` renders `#` as `<h2>`). */
  shift?: number
  /** Drop the first `#` heading (the page renders its own title). */
  dropTitle?: boolean
  /** Replace the text of the first `#` heading. */
  titleHtml?: string
  /** Source file, used to resolve relative links. */
  file?: string
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;|&#\d+;/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

/** Guides under `/docs/:slug`, in sidebar order. `file` is relative to the repo root. */
export const guides: Record<string, { title: string; description: string; file: string }> = {
  installation: {
    title: 'Installation',
    description: 'Set up a Remix 3 app for Stems components and add your first one.',
    file: 'docs/installation.md',
  },
  theming: {
    title: 'Theming',
    description: 'Theme tokens, dark mode, radius, and styling state with data attributes.',
    file: 'docs/theming.md',
  },
  headless: {
    title: 'Headless usage',
    description: 'Use stems-ui directly with your own markup and styles.',
    file: 'docs/headless.md',
  },
  'remix-notes': {
    title: 'Remix notes',
    description: 'Rough edges in Remix 3.1 found while building Stems, and the workarounds.',
    file: 'docs/upstream-issues.md',
  },
}

/**
 * Headless modules with a README but no component page (e.g. `separator`, `anchor`). They get a
 * standalone reference page at `/api/:module`.
 */
export const headlessOnlyModules: string[] = readdirSync(
  path.join(repoRoot, 'packages/stems-ui/src'),
  {
    withFileTypes: true,
  },
)
  .filter((entry) => entry.isDirectory() && entry.name !== 'lib')
  .map((entry) => entry.name)
  .filter((name) => existsSync(moduleReadmePath(name)) && pageForModule(name) === undefined)
  .sort()

/** `stems-ui/tabs` → `packages/stems-ui/src/tabs/README.md` (absolute). */
export function moduleReadmePath(module: string) {
  return path.join(
    repoRoot,
    'packages/stems-ui/src',
    module.replace(/^stems-ui\//, ''),
    'README.md',
  )
}

/** The component page documenting a headless module, preferring the page with the same name. */
export function pageForModule(name: string) {
  if (Object.hasOwn(demos, name) && demos[name]!.behavior.includes(`stems-ui/${name}`)) return name
  return Object.keys(demos).find((key) => demos[key]!.behavior.includes(`stems-ui/${name}`))
}

/**
 * Rewrites repo-relative markdown links to docs routes:
 * - `../menu/README.md#parts` (between module READMEs) → `/components/dropdown-menu#menu-parts`
 * - `./installation.md` (between guides) → `/docs/installation`
 */
function rewriteHref(href: string, file: string | undefined) {
  if (!file || /^[a-z]+:|^#|^\//i.test(href)) return href
  let [target = '', hash] = href.split('#')
  let absolute = path.resolve(path.dirname(file), target)
  let readme = absolute.match(/packages\/stems-ui\/src\/([^/]+)\/README\.md$/)
  if (readme) {
    let module = readme[1]!
    let page = pageForModule(module)
    if (page) return `/components/${page}#${hash ? `${module}-${hash}` : module}`
    return `/api/${module}${hash ? `#${module}-${hash}` : ''}`
  }
  let guide = Object.keys(guides).find(
    (slug) => path.join(repoRoot, guides[slug]!.file) === absolute,
  )
  if (guide) return `/docs/${guide}${hash ? `#${hash}` : ''}`
  return href
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderMarkdown(source: string, options: RenderOptions = {}): RenderedMarkdown {
  let { idPrefix, shift = 0, dropTitle = false, titleHtml, file } = options
  let toc: TocEntry[] = []
  let used = new Map<string, number>()
  let title: string | undefined
  let seenTitle = false

  let marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth, text }: Tokens.Heading) {
        let inline = this.parser.parseInline(tokens)
        let isTitle = depth === 1 && !seenTitle
        if (isTitle) {
          seenTitle = true
          title = text
          if (dropTitle) return ''
          if (titleHtml !== undefined) inline = titleHtml
        }
        let base = isTitle && idPrefix ? idPrefix : slugify(inline)
        if (!isTitle && idPrefix) base = `${idPrefix}-${base}`
        let count = used.get(base) ?? 0
        used.set(base, count + 1)
        let id = count === 0 ? base : `${base}-${count}`
        let level = Math.min(depth + shift, 6)
        toc.push({ depth: level, id, html: inline })
        return `<h${level} id="${id}"><a class="heading-anchor" href="#${id}">${inline}</a></h${level}>\n`
      },
      link({ href, title: linkTitle, tokens }: Tokens.Link) {
        let inner = this.parser.parseInline(tokens)
        let target = rewriteHref(href, file)
        let external = /^https?:/.test(target)
        return `<a href="${escapeHtml(target)}"${linkTitle ? ` title="${escapeHtml(linkTitle)}"` : ''}${
          external ? ' rel="noreferrer"' : ''
        }>${inner}</a>`
      },
      code({ text, lang }: Tokens.Code) {
        let language = (lang ?? '').split(/\s+/)[0]
        let label = language ? ` data-lang="${escapeHtml(language)}"` : ''
        return `<pre class="th-code"${label}><code>${highlightCode(text.replace(/\n$/, ''), language)}</code></pre>\n`
      },
      table(token: Tokens.Table) {
        // Wide API tables scroll horizontally instead of stretching the page.
        let header = token.header
          .map(
            (cell) =>
              `<th${cell.align ? ` align="${cell.align}"` : ''}>${this.parser.parseInline(cell.tokens)}</th>`,
          )
          .join('')
        let body = token.rows
          .map(
            (row) =>
              `<tr>${row
                .map(
                  (cell) =>
                    `<td${cell.align ? ` align="${cell.align}"` : ''}>${this.parser.parseInline(cell.tokens)}</td>`,
                )
                .join('')}</tr>`,
          )
          .join('\n')
        return `<div class="table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>\n`
      },
      html({ text }: Tokens.HTML | Tokens.Tag) {
        // Drop HTML comments (attribution headers in ported READMEs).
        return text.replace(/<!--[\s\S]*?-->/g, '')
      },
    },
  })

  let html = marked.parse(source, { async: false }) as string
  return { html, toc, title }
}

export async function readMarkdownFile(file: string, options: RenderOptions = {}) {
  let absolute = path.isAbsolute(file) ? file : path.join(repoRoot, file)
  return cached(`md:${absolute}:${JSON.stringify(options)}`, async () =>
    renderMarkdown(await fs.readFile(absolute, 'utf8'), { ...options, file: absolute }),
  )
}

export interface ModuleReference extends RenderedMarkdown {
  module: string
}

/** Renders a module README as a standalone page (title dropped, `##` stays `<h2>`). */
export async function readModuleReference(module: string): Promise<ModuleReference> {
  let name = module.replace(/^stems-ui\//, '')
  let rendered = await readMarkdownFile(moduleReadmePath(name), { idPrefix: name, dropTitle: true })
  return { module: `stems-ui/${name}`, ...rendered }
}

/**
 * Renders each behavior module's README for a component page, under its "API reference" `<h2>`:
 * the README's `#` becomes `<h3>` (ids prefixed with the module name, e.g. `tabs-usage`).
 */
export async function readModuleReferences(modules: string[]): Promise<ModuleReference[]> {
  return Promise.all(
    modules.map(async (module) => {
      let name = module.replace(/^stems-ui\//, '')
      let rendered = await readMarkdownFile(moduleReadmePath(module), {
        idPrefix: name,
        shift: 2,
        titleHtml: `<code>${escapeHtml(module)}</code>`,
      })
      return { module, ...rendered }
    }),
  )
}

/** The demo module source shown in a component page's "Code" section. */
export async function readDemoSource(name: string) {
  let file = path.join(rootDir, 'app/demos/public', `${name}.tsx`)
  return cached(`src:${file}`, () => fs.readFile(file, 'utf8'))
}

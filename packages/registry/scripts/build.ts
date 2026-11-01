/**
 * Builds the shadcn registry.
 *
 * Authored sources import each other through this package's `#stems/*` subpath imports, so the docs
 * app can run them directly. shadcn only rewrites `@/registry/...` imports to the user's aliases, so
 * this script:
 *
 *   1. copies every registry file into `.build/registry/stems/`, rewriting `#stems/` imports to
 *      `@/registry/stems/`,
 *   2. fills the `theme` item's cssVars from `src/styles/theme.css` (the single source of truth),
 *   3. runs `shadcn build` to emit `apps/docs/public/r/*.json`.
 *
 * Usage: node scripts/build.ts [--out <dir>]
 *
 * Set STEMS_UI_SPEC (e.g. `file:/abs/path/stems-ui-0.0.0.tgz`) to point the `stems-ui` dependency
 * at an unpublished build when testing `shadcn add` locally.
 */
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

interface RegistryFile {
  path: string
  type: string
  target?: string
}

interface RegistryItem {
  name: string
  type: string
  files?: RegistryFile[]
  dependencies?: string[]
  cssVars?: Record<string, Record<string, string>>
  css?: Record<string, unknown>
  [key: string]: unknown
}

interface Registry {
  items: RegistryItem[]
  [key: string]: unknown
}

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = path.join(pkgDir, '.build')
const outFlag = process.argv.indexOf('--out')
const outDir =
  outFlag === -1
    ? path.resolve(pkgDir, '../../apps/docs/public/r')
    : path.resolve(process.cwd(), process.argv[outFlag + 1]!)

const registry = JSON.parse(fs.readFileSync(path.join(pkgDir, 'registry.json'), 'utf8')) as Registry

fs.rmSync(buildDir, { recursive: true, force: true })

for (let item of registry.items) {
  for (let file of item.files ?? []) {
    let source = fs.readFileSync(path.join(pkgDir, file.path), 'utf8')
    let rel = path.relative('src', file.path)
    let dest = path.join('registry', 'stems', rel)

    fs.mkdirSync(path.dirname(path.join(buildDir, dest)), { recursive: true })
    fs.writeFileSync(path.join(buildDir, dest), rewriteImports(source))
    file.path = dest
  }

  // For testing installs before stems-ui is published, e.g. STEMS_UI_SPEC=file:/tmp/stems-ui.tgz
  if (process.env.STEMS_UI_SPEC && Array.isArray(item.dependencies)) {
    item.dependencies = item.dependencies.map((dep) =>
      dep === 'stems-ui' ? `stems-ui@${process.env.STEMS_UI_SPEC}` : dep,
    )
  }

  if (item.name === 'theme') {
    let theme = parseTheme(fs.readFileSync(path.join(pkgDir, 'src/styles/theme.css'), 'utf8'))
    item.cssVars = theme
  }
}

fs.writeFileSync(path.join(buildDir, 'registry.json'), JSON.stringify(registry, null, 2) + '\n')

fs.mkdirSync(outDir, { recursive: true })
execFileSync(
  path.join(pkgDir, 'node_modules/.bin/shadcn'),
  ['build', 'registry.json', '--output', outDir],
  { cwd: buildDir, stdio: 'inherit' },
)

function rewriteImports(source: string): string {
  return source.replace(/(['"])#stems\//g, '$1@/registry/stems/')
}

/** Extracts `:root`, `.dark`, and `@theme inline` custom properties into shadcn cssVars. */
function parseTheme(css: string): Record<string, Record<string, string>> {
  return {
    theme: readBlock(css, '@theme inline'),
    light: readBlock(css, ':root'),
    dark: readBlock(css, '.dark'),
  }
}

function readBlock(css: string, selector: string): Record<string, string> {
  let start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`theme.css is missing a "${selector}" block`)

  let body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  let vars: Record<string, string> = {}

  for (let match of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    vars[match[1]!] = match[2]!.trim()
  }

  return vars
}

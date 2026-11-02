/**
 * Prerenders the docs site to static files for Cloudflare (Workers static assets).
 *
 * Every page is already server-rendered, so the static build is the router's own output: starting
 * at `/`, crawl through `router.fetch` and follow every same-origin link plus every `/assets/...`
 * URL found in HTML (import maps, preloads, client entries) and in compiled JavaScript. `public/`
 * (CSS, favicon, registry JSON) is copied as-is, and redirects become a Cloudflare `_redirects`
 * file.
 *
 * Usage: NODE_ENV=production node --import remix/node-tsx scripts/prerender.ts [--out build/site]
 */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { parseArgs } from 'node:util'

const rootDir = path.resolve(import.meta.dirname, '..')
const { values } = parseArgs({ options: { out: { type: 'string', default: 'build/site' } } })
const outDir = path.resolve(rootDir, values.out!)

if (process.env.NODE_ENV !== 'production') {
  throw new Error('Run the prerender with NODE_ENV=production (minified assets, no HMR).')
}

const { router } = await import('../app/router.ts')
const { assets } = await import('../app/assets.ts')

const origin = 'http://localhost'
const publicDir = path.join(rootDir, 'public')

await fs.rm(outDir, { recursive: true, force: true })
await fs.cp(publicDir, outDir, { recursive: true })
const publicFiles = new Set((await listFiles(publicDir)).map((file) => '/' + file))

let queue = ['/']
let seen = new Set<string>(queue)
let redirects: string[] = []
let pageCount = 0
let assetCount = 0

while (queue.length > 0) {
  let pathname = queue.shift()!
  let response = await router.fetch(new Request(origin + pathname, { redirect: 'manual' }))

  if (response.status >= 300 && response.status < 400) {
    let location = response.headers.get('Location')
    if (location) redirects.push(`${pathname} ${location} ${response.status}`)
    if (location?.startsWith('/')) enqueue(location)
    continue
  }
  if (!response.ok) {
    throw new Error(`GET ${pathname} → ${response.status}`)
  }

  let type = response.headers.get('Content-Type') ?? ''
  let body = new Uint8Array(await response.arrayBuffer())
  let isHtml = type.includes('text/html')
  let isText =
    isHtml || type.includes('javascript') || type.includes('css') || type.includes('json')
  let text = isText ? new TextDecoder().decode(body) : ''
  if (isText) {
    for (let url of findUrls(text, isHtml)) enqueue(url)
    body = new TextEncoder().encode(rewriteAssetUrls(text))
  }
  let file = isHtml ? htmlFile(pathname) : safeAssetPath(pathname)
  await fs.mkdir(path.dirname(path.join(outDir, file)), { recursive: true })
  await fs.writeFile(path.join(outDir, file), body)
  if (isHtml) pageCount++
  else assetCount++
}

await fs.writeFile(path.join(outDir, '_redirects'), redirects.join('\n') + '\n')
await fs.writeFile(
  path.join(outDir, '404.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Not found · Stems UI</title><link rel="stylesheet" href="/styles.css" />
<script>try{if(localStorage.getItem('theme')==='dark'||(!localStorage.getItem('theme')&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch{}</script>
</head><body class="grid min-h-screen place-items-center"><main class="flex flex-col items-center gap-3 text-center">
<h1 class="text-2xl font-semibold">Page not found</h1>
<p class="text-muted-foreground">That page doesn't exist.</p>
<a class="underline underline-offset-4" href="/">Back to Stems UI</a></main></body></html>
`,
)
await fs.writeFile(
  path.join(outDir, '_headers'),
  [
    // Remix serves compiled modules at their source paths. Static hosts guess `.ts` as
    // video/mp2t and `.tsx` as unknown, and browsers refuse module scripts without a JS type.
    '/assets/*.ts',
    '  Content-Type: text/javascript; charset=utf-8',
    '/assets/*.tsx',
    '  Content-Type: text/javascript; charset=utf-8',
    '/assets/*',
    '  Cache-Control: public, max-age=3600, must-revalidate',
    '/r/*',
    '  Cache-Control: public, max-age=300, must-revalidate',
    '  Access-Control-Allow-Origin: *',
    '',
  ].join('\n'),
)
await assets.close?.()
console.log(
  `Prerendered ${pageCount} pages, ${assetCount} assets, ${redirects.length} redirects → ${path.relative(process.cwd(), outDir)}`,
)

function enqueue(url: string) {
  let pathname = new URL(url, origin + '/').pathname
  if (seen.has(pathname) || publicFiles.has(pathname)) return
  seen.add(pathname)
  queue.push(pathname)
}

/** Same-origin page links and every `/assets/...` reference. */
function* findUrls(text: string, isHtml: boolean): Generator<string> {
  for (let match of text.matchAll(/["'(\s]\/assets\/[^"'\s)<>]+/g)) {
    let url = match[0].slice(1)
    // Import map scope keys (`/assets/app/`) are URL prefixes, not files.
    if (!url.endsWith('/')) yield url
  }
  if (isHtml) {
    for (let match of text.matchAll(/\shref="(\/[^"#?]*)"/g)) {
      let href = match[1]!
      if (!href.startsWith('//') && !path.extname(href)) yield href
    }
  }
}

/**
 * Asset URLs contain `@` and percent-encoded `@`/`+` (e.g. `__@remix/virtual-store/%40remix-run%2B…`).
 * Hosts canonicalize those differently (Cloudflare redirects `@` to `%40`), and an ES module
 * loaded under two URLs is evaluated twice, which duplicated the Remix runtime and broke
 * hydration. Map every spelling to one path made of unreserved characters only.
 */
function safeAssetPath(pathname: string) {
  return decodeURIComponent(pathname).replace(
    /[^A-Za-z0-9._~/-]/g,
    (char) => `~${char.codePointAt(0)!.toString(16)}~`,
  )
}

function rewriteAssetUrls(text: string) {
  // Includes import map scope prefixes (`/assets/__@remix/virtual-store/`), which must keep
  // matching the renamed module URLs.
  return text.replace(
    /(["'(\s])(\/assets\/[^"'\s)<>]+)/g,
    (_match, lead: string, url: string) => lead + safeAssetPath(url),
  )
}

function htmlFile(pathname: string) {
  return pathname === '/' ? '/index.html' : `${pathname.replace(/\/$/, '')}/index.html`
}

async function listFiles(dir: string, prefix = ''): Promise<string[]> {
  let entries = await fs.readdir(dir, { withFileTypes: true })
  let files: string[] = []
  for (let entry of entries) {
    let rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...(await listFiles(path.join(dir, entry.name), rel)))
    else files.push(rel)
  }
  return files
}

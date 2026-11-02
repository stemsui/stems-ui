import type { Handle, RemixNode } from 'remix/component'
import { unsafeHTML } from 'remix/component'
import { ImportMap } from 'remix/component/server'

import { scriptEntry } from '../assets.ts'
import { highlightThemeCss } from '../highlight.ts'
import { THEME_STORAGE_KEY } from '../ui/public/theme-toggle.tsx'

// Runs before first paint so the page never flashes the wrong theme: a saved choice wins,
// otherwise follow the OS setting.
const themeScript = `(() => {
  try {
    let saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})
    let dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', dark)
  } catch {}
})()`

export interface DocumentProps {
  children?: RemixNode
  head?: RemixNode
  title?: string
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { children, head, title = 'Stems UI' } = handle.props
    let { href, importMap, preloads } = scriptEntry

    return (
      // The theme class belongs to the browser, not the incoming server-rendered document.
      <html lang="en" data-rmx-preserve-attrs="class">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <script innerHTML={unsafeHTML(themeScript)} />
          <title>{title}</title>
          <link rel="stylesheet" href="/styles.css" />
          <style innerHTML={unsafeHTML(highlightThemeCss)} />
          {head}
          <ImportMap value={importMap} />
          {preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
          ))}
          <script type="module" src={href}></script>
        </head>
        <body class="min-h-screen antialiased">{children}</body>
      </html>
    )
  }
}

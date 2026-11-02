import { createHighlighter, renderNodesToHtml, renderTokens } from '@tanstack/highlight/core'
import { css } from '@tanstack/highlight/languages/css'
import { diff } from '@tanstack/highlight/languages/diff'
import { html } from '@tanstack/highlight/languages/html'
import { js } from '@tanstack/highlight/languages/js'
import { json } from '@tanstack/highlight/languages/json'
import { shell } from '@tanstack/highlight/languages/shell'
import { ts } from '@tanstack/highlight/languages/ts'
import { tsx } from '@tanstack/highlight/languages/tsx'
import { createThemeCss } from '@tanstack/highlight/theme'
import { githubDarkTheme } from '@tanstack/highlight/themes/github-dark'
import { githubLightTheme } from '@tanstack/highlight/themes/github-light'

// Server-only: prerendered pages contain the tokens, not the highlighter runtime.
let highlighter = createHighlighter({ languages: [css, diff, html, js, json, shell, ts, tsx] })

/** Escaped token markup for the inside of a <code> element. Unknown languages stay plain text. */
export function highlightCode(code: string, lang?: string) {
  let { tokens } = highlighter.tokenize(code, { lang })
  return renderNodesToHtml(renderTokens(tokens))
}

export const highlightThemeCss = createThemeCss({
  light: githubLightTheme,
  dark: githubDarkTheme,
  darkSelector: '.dark',
})

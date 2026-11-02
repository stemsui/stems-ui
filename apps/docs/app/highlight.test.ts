import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { renderMarkdown } from './content.ts'
import { highlightCode } from './highlight.ts'

describe('syntax highlighting', () => {
  for (let [lang, source, token] of [
    ['ts', 'const answer: number = 42', 'keyword'],
    ['typescript', 'const answer = 42', 'keyword'],
    ['tsx', '<Button disabled>Save</Button>', 'tag'],
    ['html', '<button disabled>Save</button>', 'tag'],
    ['css', '.button { color: red; }', 'selector'],
    ['json', '{"name": "stems-ui"}', 'string'],
    ['sh', 'pnpm add stems-ui', 'command'],
    ['diff', '+added\n-removed', 'inserted'],
  ]) {
    it(`highlights ${lang} code blocks in Markdown`, () => {
      let { html } = renderMarkdown(`\`\`\`${lang}\n${source}\n\`\`\``)
      assert.ok(html.includes(`<pre class="th-code" data-lang="${lang}"><code>`))
      assert.ok(html.includes(`th-${token}`))
    })
  }

  it('escapes markup in highlighted code', () => {
    let html = highlightCode('const text = "<script>alert(1)</script>"', 'ts')
    assert.ok(html.includes('&lt;script&gt;'))
    assert.ok(!html.includes('<script>'))
  })

  it('renders unknown and unlabelled languages as escaped plain text', () => {
    for (let lang of [undefined, 'not-a-language']) {
      assert.equal(
        highlightCode('<img src=x onerror="alert(1)"> &', lang),
        '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp;',
      )
    }
  })

  it('keeps inline code unchanged', () => {
    assert.equal(
      renderMarkdown('Use `const answer = 42`.').html,
      '<p>Use <code>const answer = 42</code>.</p>\n',
    )
  })
})

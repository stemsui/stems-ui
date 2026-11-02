import * as fs from 'node:fs'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { guides, headlessOnlyModules, moduleReadmePath, repoRoot } from '../content.ts'
import { demos } from '../demos/index.ts'
import { router } from '../router.ts'
import { routes } from '../routes.ts'

async function get(href: string) {
  let response = await router.fetch(new URL(href, 'http://localhost'))
  return { response, html: await response.text() }
}

/** The first `## ` heading of a markdown file, as it appears in rendered HTML. */
function firstSection(file: string) {
  let heading = fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .find((line) => line.startsWith('## '))
  assert.ok(heading, `${file} has a ## heading`)
  return heading
    .slice(3)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/'/g, '&#39;')
}

describe('component pages', () => {
  for (let [name, demo] of Object.entries(demos)) {
    it(`GET /components/${name} renders the demo, code, and API reference`, async () => {
      let { response, html } = await get(routes.component.href({ name }))
      assert.equal(response.status, 200)
      assert.match(html, /data-testid="demo"/)
      assert.match(html, /id="demo-source"/)
      assert.ok(html.includes(`npx shadcn add @stemsui/${demo.registryItem ?? name}`))
      if (demo.behavior.length > 0) assert.match(html, /data-testid="reference"/)
      if (demo.documentation) {
        assert.match(html, /data-testid="component-documentation"/)
        assert.ok(html.includes(firstSection(path.join(repoRoot, demo.documentation))))
      }
      for (let module of demo.behavior) {
        let id = module.replace('stems-ui/', '')
        assert.ok(html.includes(`data-module="${module}"`), `${module} reference`)
        assert.ok(html.includes(`id="${id}"`), `${module} heading anchor`)
        assert.ok(html.includes(firstSection(moduleReadmePath(module))), `${module} README content`)
      }
    })
  }

  it('returns 404 for an unknown component', async () => {
    let { response } = await get(routes.component.href({ name: 'nope' }))
    assert.equal(response.status, 404)
  })
})

describe('guides', () => {
  for (let [slug, guide] of Object.entries(guides)) {
    it(`GET /docs/${slug} renders ${guide.file}`, async () => {
      let { response, html } = await get(routes.guide.href({ slug }))
      assert.equal(response.status, 200)
      assert.match(html, /data-testid="guide"/)
      assert.ok(
        html.includes(`<h1 class="text-3xl font-semibold tracking-tight">${guide.title}</h1>`),
      )
      assert.ok(html.includes(firstSection(path.join(repoRoot, guide.file))), 'guide content')
      assert.match(html, /aria-label="On this page"/)
    })
  }

  it('returns 404 for an unknown guide', async () => {
    let { response } = await get(routes.guide.href({ slug: 'nope' }))
    assert.equal(response.status, 404)
  })

  it('links guides and components in the sidebar', async () => {
    let { html } = await get(routes.home.href())
    for (let slug of Object.keys(guides)) assert.ok(html.includes(`href="/docs/${slug}"`))
    assert.ok(html.includes('href="/components/tabs"'))
    assert.match(html, /data-testid="theme-toggle"/)
  })
})

describe('headless-only module pages', () => {
  it('lists modules without a component page', () => {
    assert.ok(headlessOnlyModules.includes('separator'))
    assert.ok(!headlessOnlyModules.includes('tabs'))
  })

  for (let module of headlessOnlyModules) {
    it(`GET /api/${module} renders its README`, async () => {
      let { response, html } = await get(routes.api.href({ module }))
      assert.equal(response.status, 200)
      assert.ok(html.includes(`data-module="stems-ui/${module}"`))
      assert.ok(html.includes(firstSection(moduleReadmePath(module))), 'README content')
    })
  }

  it('redirects modules that have a component page', async () => {
    let response = await router.fetch(
      new URL(routes.api.href({ module: 'menu' }), 'http://localhost'),
    )
    assert.equal(response.status, 301)
    assert.equal(new URL(response.headers.get('Location')!).pathname, '/components/dropdown-menu')
  })

  it('links module READMEs without a page to /api', async () => {
    let { html } = await get(routes.component.href({ name: 'dropdown-menu' }))
    assert.ok(html.includes('href="/api/separator"'))
    assert.ok(!html.includes('README.md'))
  })
})

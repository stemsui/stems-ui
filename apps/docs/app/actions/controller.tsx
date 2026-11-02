import { createController } from 'remix/router'

import { assets } from '../assets.ts'
import {
  guides,
  headlessOnlyModules,
  pageForModule,
  readDemoSource,
  readMarkdownFile,
  readModuleReference,
  readModuleReferences,
} from '../content.ts'
import { demos } from '../demos/index.ts'
import { routes } from '../routes.ts'
import { ApiPage } from './api-page.tsx'
import { ComponentPage } from './component-page.tsx'
import { GuidePage } from './guide-page.tsx'
import { HomePage } from './home-page.tsx'

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
    },
    home(context) {
      return context.render(<HomePage />)
    },
    async component(context) {
      let name = context.params.name
      if (!Object.hasOwn(demos, name)) {
        return new Response('Not Found', { status: 404 })
      }
      let documentationFile = demos[name]!.documentation
      let [references, source, documentation] = await Promise.all([
        readModuleReferences(demos[name]!.behavior),
        readDemoSource(name),
        documentationFile ? readMarkdownFile(documentationFile, { dropTitle: true }) : undefined,
      ])
      return context.render(
        <ComponentPage
          name={name}
          references={references}
          source={source}
          documentation={documentation}
        />,
      )
    },
    async guide(context) {
      let slug = context.params.slug
      if (!Object.hasOwn(guides, slug)) {
        return new Response('Not Found', { status: 404 })
      }
      let content = await readMarkdownFile(guides[slug]!.file, { dropTitle: true })
      return context.render(<GuidePage slug={slug} content={content} />)
    },
    async api(context) {
      let module = context.params.module
      // Modules documented on a component page redirect there.
      let page = pageForModule(module)
      if (page) {
        return Response.redirect(
          new URL(`${routes.component.href({ name: page })}#${module}`, context.request.url),
          301,
        )
      }
      if (!headlessOnlyModules.includes(module)) {
        return new Response('Not Found', { status: 404 })
      }
      let reference = await readModuleReference(module)
      return context.render(<ApiPage reference={reference} />)
    },
  },
})

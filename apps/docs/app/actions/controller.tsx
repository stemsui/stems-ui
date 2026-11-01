import { createController } from 'remix/router'

import { assets } from '../assets.ts'
import { demos } from '../demos/index.ts'
import { routes } from '../routes.ts'
import { ComponentPage } from './component-page.tsx'
import { HomePage } from './home-page.tsx'

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
    },
    home(context) {
      return context.render(<HomePage />)
    },
    component(context) {
      let name = context.params.name
      if (!Object.hasOwn(demos, name)) {
        return new Response('Not Found', { status: 404 })
      }
      return context.render(<ComponentPage name={name} />)
    },
  },
})

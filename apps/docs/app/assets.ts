import * as path from 'node:path'

import { createAssetServer } from 'remix/assets'
import { componentHmr } from 'remix/component-hmr/assets'

// Resolve from this file, not the cwd: tests run from the monorepo root.
export const rootDir = path.resolve(import.meta.dirname, '..')
const nodeEnv = process.env.NODE_ENV ?? 'development'
const isDevelopment = nodeEnv === 'development'
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR)

export const assets = createAssetServer({
  basePath: '/assets',
  rootDir,
  // Workspace packages (stems-ui, the registry sources) live outside this app, so mount them too.
  mounts: {
    app: 'app',
    npm: 'node_modules',
    packages: '../../packages',
  },

  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix', 'stems-ui', '@stemsui/registry', 'cn'],
  denyFiles: ['app/**/*.test.*'],
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  watch: isDevelopment,
  hmr: isHmr
    ? {
        channel: async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel(),
        moduleImporter: 'remix/multiple-import-maps-polyfill',
      }
    : undefined,
  scripts: { loaders: isHmr ? [componentHmr()] : undefined },
})

const entry = 'app/actions/public/entry.ts'

export const scriptEntry = await assets.getScriptEntry(entry)

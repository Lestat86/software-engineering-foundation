import { defineConfig } from 'eslint/config'

import {
  createJavaScriptConfig,
  foundationIgnores,
} from './.config/eslint/base.mjs'
import { createNodeConfig, createProcessEnvConfig } from './.config/eslint/node.mjs'
import {
  createReactConfig,
  createViteReactRefreshConfig,
} from './.config/eslint/react.mjs'
import { createStylisticConfig } from './.config/eslint/stylistic.mjs'
import { createTypeScriptConfig } from './.config/eslint/typescript.mjs'

const clientFiles = ['apps/client/**/*.{jsx,tsx}']

// One root configuration lints every workspace. The TypeScript project service
// picks each workspace's own tsconfig, so typed rules stay accurate per app.
export default defineConfig(
  foundationIgnores,
  {
    name: 'project/ignores',
    ignores: ['**/.vitest/**', 'apps/client/playwright-report/**', 'apps/client/test-results/**'],
  },
  createJavaScriptConfig(),
  createTypeScriptConfig({ tsconfigRootDir: import.meta.dirname }),
  createNodeConfig({
    files: [
      '*.config.{mjs,ts}',
      '.config/**/*.mjs',
      'apps/server/**/*.{ts,mts,cts}',
      'apps/client/*.config.ts',
      'apps/client/e2e/**/*.ts',
      'packages/**/*.{ts,mts,cts}',
    ],
  }),
  // The configuration modules of the Fastify and Nest servers.
  createProcessEnvConfig({
    files: ['apps/server/src/**/*.ts'],
    configModules: ['apps/server/src/config.ts', 'apps/server/src/server.ts', 'apps/server/src/config/env.ts'],
  }),
  {
    name: 'project/server-decorators',
    files: ['apps/server/**/*.ts'],
    rules: {
      // Nest modules are decorated classes without members by design; the
      // option is inert for servers that do not use decorators.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  // Map design-system wrappers to their rendered semantics here so jsx-a11y
  // understands abstractions, for example components: { Button: 'button' }.
  createReactConfig({ attributes: {}, components: {}, files: clientFiles }),
  createViteReactRefreshConfig({ files: clientFiles }),
  createStylisticConfig(),
)

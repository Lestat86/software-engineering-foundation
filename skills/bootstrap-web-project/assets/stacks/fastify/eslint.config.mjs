import { defineConfig } from 'eslint/config'

import {
  createJavaScriptConfig,
  foundationIgnores,
} from '{{CONFIG_ROOT}}/eslint/base.mjs'
import { createNodeConfig, createProcessEnvConfig } from '{{CONFIG_ROOT}}/eslint/node.mjs'
import { createStylisticConfig } from '{{CONFIG_ROOT}}/eslint/stylistic.mjs'
import { createTypeScriptConfig } from '{{CONFIG_ROOT}}/eslint/typescript.mjs'

export default defineConfig(
  foundationIgnores,
  { name: 'project/ignores', ignores: ['.vitest/**'] },
  createJavaScriptConfig(),
  createTypeScriptConfig({ tsconfigRootDir: import.meta.dirname }),
  createNodeConfig(),
  createProcessEnvConfig({ files: ['src/**/*.ts'], configModules: ['src/config.ts', 'src/server.ts'] }),
  createStylisticConfig(),
)

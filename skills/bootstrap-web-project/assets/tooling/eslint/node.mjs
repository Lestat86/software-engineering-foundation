import { defineConfig } from 'eslint/config'
import globals from 'globals'

const defaultNodeFiles = ['**/*.{js,mjs,cjs,ts,mts,cts}']

/** @public Part of the module API that project configurations compose. */
export const createNodeConfig = ({
  allowConsole = false,
  files = defaultNodeFiles,
} = {}) => defineConfig({
  name: 'foundation/node',
  files,
  languageOptions: {
    globals: globals.node,
  },
  rules: {
    'no-console': allowConsole ? 'off' : 'error',
  },
})

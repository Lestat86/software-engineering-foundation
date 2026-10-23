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

/**
 * @public The `no-restricted-properties` entry that keeps `process.env` in the
 * configuration module (CORE-CONFIG-001). ESLint replaces a rule's options
 * instead of merging them: a later block that sets `no-restricted-properties`
 * for the same files must repeat this entry, or the restriction is lost.
 */
export const processEnvRestriction = {
  object: 'process',
  property: 'env',
  message: 'Read configuration from the validated configuration module, not from process.env.',
}

// Tests set and read the environment they run in.
const defaultTestFiles = ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}', '**/test/**', '**/e2e/**']

/**
 * @public Rejects `process.env` in source files outside the configuration
 * modules, where a read would skip validation (CORE-CONFIG-001).
 */
export const createProcessEnvConfig = ({ configModules, files }) => defineConfig({
  name: 'foundation/process-env',
  files,
  ignores: [...configModules, ...defaultTestFiles],
  rules: {
    'no-restricted-properties': ['error', processEnvRestriction],
  },
})

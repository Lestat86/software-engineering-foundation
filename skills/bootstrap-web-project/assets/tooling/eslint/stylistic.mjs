import stylistic from '@stylistic/eslint-plugin'
import { defineConfig } from 'eslint/config'

const defaultCodeFiles = ['**/*.{js,mjs,cjs,ts,tsx,mts,cts,jsx}']

/** @public Part of the module API that project configurations compose. */
export const createStylisticConfig = ({ files = defaultCodeFiles } = {}) => defineConfig({
  name: 'foundation/stylistic',
  files,
  extends: [
    stylistic.configs.customize({
      arrowParens: true,
      braceStyle: '1tbs',
      commaDangle: 'always-multiline',
      indent: 2,
      jsx: true,
      quotes: 'single',
      semi: false,
    }),
  ],
  rules: {
    '@stylistic/array-bracket-spacing': ['error', 'never'],
    '@stylistic/max-len': [
      'error',
      {
        code: 100,
        ignoreRegExpLiterals: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreUrls: true,
      },
    ],
    '@stylistic/object-curly-spacing': ['error', 'always'],
  },
})

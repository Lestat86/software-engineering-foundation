import eslint from '@eslint/js'
import importPlugin from 'eslint-plugin-import'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

import {
  arrowFunctionRules,
  codeHealthConfigs,
  codeHealthRules,
  magicNumberOptions,
} from './base.mjs'

const defaultTypeScriptFiles = ['**/*.{ts,tsx,mts,cts}']

const defaultLiteralExemptFiles = [
  '**/*.{test,spec}.{ts,tsx,mts,cts}',
  '**/test/**/*.{ts,tsx,mts,cts}',
  '**/e2e/**/*.{ts,mts,cts}',
  '**/*.config.{ts,mts,cts}',
  '**/.config/**/*.{ts,mts,cts}',
]

const defaultConstantsFiles = ['**/*.constants.{ts,mts,cts}']

export const createTypeScriptConfig = ({
  constantsFiles = defaultConstantsFiles,
  files = defaultTypeScriptFiles,
  literalExemptFiles = defaultLiteralExemptFiles,
  tsconfigRootDir,
} = {}) => {
  if (!tsconfigRootDir) {
    throw new Error('createTypeScriptConfig requires tsconfigRootDir')
  }

  return defineConfig([
    {
      name: 'foundation/typescript',
      files,
      extends: [
        eslint.configs.recommended,
        ...tseslint.configs.strictTypeChecked,
        ...tseslint.configs.stylisticTypeChecked,
        importPlugin.flatConfigs.recommended,
        importPlugin.flatConfigs.typescript,
        ...codeHealthConfigs,
      ],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      linterOptions: {
        reportUnusedDisableDirectives: 'error',
        reportUnusedInlineConfigs: 'error',
      },
      settings: {
        'import/resolver': {
          node: true,
          typescript: true,
        },
      },
      rules: {
        ...arrowFunctionRules,
        ...codeHealthRules,
        'import/first': 'error',
        'import/newline-after-import': 'error',
        'import/no-cycle': ['error', { ignoreExternal: true }],
        'import/no-duplicates': 'error',
        'import/no-self-import': 'error',
        'no-magic-numbers': 'off',
        'no-unused-vars': 'off',
        '@typescript-eslint/consistent-type-exports': 'error',
        '@typescript-eslint/consistent-type-definitions': 'off',
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { fixStyle: 'inline-type-imports', prefer: 'type-imports' },
        ],
        '@typescript-eslint/explicit-module-boundary-types': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-import-type-side-effects': 'error',
        // An enum member, a numeric literal type and a readonly class property
        // are already named declarations of their value.
        '@typescript-eslint/no-magic-numbers': [
          'error',
          {
            ...magicNumberOptions,
            ignoreEnums: true,
            ignoreNumericLiteralTypes: true,
            ignoreReadonlyClassProperties: true,
            ignoreTypeIndexes: true,
          },
        ],
        '@typescript-eslint/no-unnecessary-condition': 'error',
        '@typescript-eslint/no-unnecessary-type-arguments': 'error',
        '@typescript-eslint/no-unnecessary-type-assertion': 'error',
        '@typescript-eslint/return-await': ['error', 'in-try-catch'],
        '@typescript-eslint/switch-exhaustiveness-check': 'error',
        // `strictNullChecks` proves nullability from the types; the SonarJS
        // rule ignores them and reports typed values such as a `string`.
        'sonarjs/null-dereference': 'off',
        '@typescript-eslint/ban-ts-comment': [
          'error',
          {
            'minimumDescriptionLength': 10,
            'ts-check': false,
            'ts-expect-error': 'allow-with-description',
            'ts-ignore': true,
            'ts-nocheck': true,
          },
        ],
      },
    },
    {
      name: 'foundation/typescript-literals',
      files: literalExemptFiles,
      plugins: { '@typescript-eslint': tseslint.plugin },
      rules: {
        '@typescript-eslint/no-magic-numbers': 'off',
      },
    },
    {
      // A constants module holds named values only, so every binding it
      // exports is a constant and reads as one at each call site.
      name: 'foundation/typescript-constants',
      files: constantsFiles,
      plugins: { '@typescript-eslint': tseslint.plugin },
      rules: {
        '@typescript-eslint/naming-convention': [
          'error',
          {
            selector: 'variable',
            modifiers: ['const', 'exported'],
            format: ['UPPER_CASE'],
          },
        ],
      },
    },
  ])
}

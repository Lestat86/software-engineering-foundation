import comments from '@eslint-community/eslint-plugin-eslint-comments/configs'
import eslint from '@eslint/js'
import importPlugin from 'eslint-plugin-import'
import sonarjs from 'eslint-plugin-sonarjs'
import { defineConfig } from 'eslint/config'

const defaultJavaScriptFiles = ['**/*.{js,mjs,cjs}']

// CORE-DEBT-001: a debt marker names the issue that tracks it. The default
// accepts a GitLab-style reference such as `TODO(#123)`; a project using another
// tracker passes its own pattern as the rule option.
/** @public */
export const defaultIssueReference = '#\\d+'

const todoIssueReferenceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require debt markers to reference the issue that tracks them.',
    },
    schema: [
      {
        type: 'object',
        properties: { reference: { type: 'string' } },
        additionalProperties: false,
      },
    ],
    messages: {
      missingReference:
        '{{marker}} must reference the issue that tracks it, for example {{marker}}(#123).',
    },
  },
  create: (context) => {
    const reference = context.options[0]?.reference ?? defaultIssueReference
    const marker = new RegExp(String.raw`\b(TODO|FIXME)\b(?!\(${reference}\))`, 'g')

    return {
      Program: () => {
        for (const comment of context.sourceCode.getAllComments()) {
          for (const match of comment.value.matchAll(marker)) {
            context.report({
              loc: comment.loc,
              messageId: 'missingReference',
              data: { marker: match[1] },
            })
          }
        }
      },
    }
  },
}

/** @public Registered by the shared configurations; exported for project rules. */
export const foundationPlugin = {
  meta: { name: 'foundation' },
  rules: { 'todo-issue-reference': todoIssueReferenceRule },
}

// Shared by the JavaScript and TypeScript configurations. The SonarJS settings
// are left out so they cannot override the React version detection.
export const codeHealthConfigs = [
  comments.recommended,
  {
    name: 'foundation/code-health',
    plugins: { foundation: foundationPlugin, sonarjs },
    rules: sonarjs.configs.recommended.rules,
  },
]

// CORE-SUPPRESS-001, CORE-DEBT-001 and CORE-COMPLEXITY-001. The SonarJS marker
// rules are replaced by the issue-reference rule, which accepts tracked debt
// instead of rejecting every marker.
export const codeHealthRules = {
  '@eslint-community/eslint-comments/require-description': [
    'error',
    { ignore: ['eslint-enable'] },
  ],
  'foundation/todo-issue-reference': 'error',
  'max-depth': ['error', 4],
  'sonarjs/cognitive-complexity': ['error', 15],
  'sonarjs/fixme-tag': 'off',
  'sonarjs/no-commented-code': 'error',
  'sonarjs/todo-tag': 'off',
}

// Numeric literals stay readable in files that are themselves declarations of
// values (tool configuration) or the specification of a behavior (tests).
/** @public Spread into `literalExemptFiles` to extend rather than replace the defaults. */
export const defaultLiteralExemptFiles = [
  '**/*.{test,spec}.{js,mjs,cjs}',
  '**/test/**/*.{js,mjs,cjs}',
  '**/e2e/**/*.{js,mjs,cjs}',
  '**/*.config.{js,mjs,cjs}',
  '**/.config/**/*.{js,mjs,cjs}',
]

export const foundationIgnores = {
  name: 'foundation/ignores',
  ignores: [
    '**/.yarn/**',
    '**/coverage/**',
    '**/dist/**',
    '**/node_modules/**',
    '**/generated/**',
  ],
}

// `func-style` and `prefer-arrow-callback` cover declarations and callbacks;
// the selector closes the remaining gap, a function expression bound to a
// variable. Generators are excluded because they have no arrow form. A project
// that sets its own `no-restricted-syntax` replaces this entry rather than
// adding to it, so it must repeat the selector.
export const arrowFunctionRules = {
  'func-style': ['error', 'expression'],
  'prefer-arrow-callback': [
    'error',
    { allowNamedFunctions: false, allowUnboundThis: true },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: 'VariableDeclarator[init.type="FunctionExpression"][init.generator=false]',
      message:
        'Use an arrow function. `function` is reserved for generators and for code that needs its own `this`, `arguments`, `new.target` or hoisting.',
    },
  ],
}

// -1, 0 and 1 carry no domain meaning to extract, and an array index is already
// named by the collection it indexes.
export const magicNumberOptions = {
  detectObjects: true,
  enforceConst: true,
  ignore: [-1, 0, 1],
  ignoreArrayIndexes: true,
}

export const createJavaScriptConfig = ({
  files = defaultJavaScriptFiles,
  literalExemptFiles = defaultLiteralExemptFiles,
} = {}) => defineConfig([
  {
    name: 'foundation/javascript',
    files,
    extends: [
      eslint.configs.recommended,
      importPlugin.flatConfigs.recommended,
      ...codeHealthConfigs,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
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
      'array-callback-return': ['error', { checkForEach: true }],
      'curly': ['error', 'all'],
      'eqeqeq': ['error', 'always'],
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-cycle': ['error', { ignoreExternal: true }],
      'import/no-duplicates': 'error',
      'import/no-self-import': 'error',
      'no-alert': 'error',
      'no-console': 'error',
      'no-debugger': 'error',
      'no-eval': 'error',
      'no-extend-native': 'error',
      'no-implied-eval': 'error',
      'no-magic-numbers': ['error', magicNumberOptions],
      'no-new-func': 'error',
      'no-promise-executor-return': 'error',
      'no-script-url': 'error',
      'no-template-curly-in-string': 'error',
      'no-unreachable-loop': 'error',
      'no-unused-private-class-members': 'error',
      'no-useless-assignment': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-const': ['error', { destructuring: 'all' }],
      'prefer-promise-reject-errors': 'error',
      'require-atomic-updates': 'error',
    },
  },
  {
    name: 'foundation/javascript-literals',
    files: literalExemptFiles,
    rules: {
      'no-magic-numbers': 'off',
    },
  },
])

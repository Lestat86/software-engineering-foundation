import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test, { before } from 'node:test'
import { fileURLToPath } from 'node:url'

import { ESLint } from 'eslint'

import { generateProject } from '../skills/bootstrap-web-project/scripts/generate-project.mjs'
import { clearGeneratedDirectory, generatedDirectory } from './helpers/generated-directory.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectDirectory = generatedDirectory('react-vite')
const binary = (name) => resolve(repositoryRoot, 'node_modules/.bin', name)

const run = (command, args) => {
  return execFileSync(command, args, {
    cwd: projectDirectory,
    encoding: 'utf8',
    env: { ...process.env, CI: '1', NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

let generated

before(() => {
  clearGeneratedDirectory('react-vite')
  generated = generateProject({
    targetDirectory: projectDirectory,
    projectName: 'foundation-react-vite-fixture',
    profiles: ['react-vite'],
  })
})

test('the generated React + Vite project is complete and fully resolved', () => {
  const requiredFiles = [
    '.config/eslint/base.mjs',
    '.config/eslint/react.mjs',
    '.config/eslint/stylistic.mjs',
    '.config/eslint/typescript.mjs',
    '.config/typescript/tsconfig.browser.json',
    '.editorconfig',
    '.engineering-foundation.yml',
    '.gitignore',
    '.husky/commit-msg',
    '.husky/pre-commit',
    '.secretlintrc.json',
    '.dependency-cruiser.mjs',
    '.node-version',
    '.yarnrc.yml',
    'AGENTS.md',
    'commitlint.config.mjs',
    'e2e/home.spec.ts',
    'eslint.config.mjs',
    'index.html',
    'lint-staged.config.mjs',
    'playwright.config.ts',
    'src/app/App.test.tsx',
    'src/main.tsx',
    'test/accessibility.ts',
    'test/setup.ts',
    'tsconfig.app.json',
    'tsconfig.node.json',
    'vite.config.ts',
  ]

  for (const file of requiredFiles) {
    assert.ok(existsSync(resolve(projectDirectory, file)), `missing generated file: ${file}`)
  }
  assert.ok(statSync(resolve(projectDirectory, '.husky/pre-commit')).mode & 0o100)

  const manifest = JSON.parse(readFileSync(resolve(projectDirectory, 'package.json'), 'utf8'))
  assert.equal(manifest.name, 'foundation-react-vite-fixture')
  assert.equal(manifest.packageManager, `yarn@${generated.versions.runtime.yarn}`)
  assert.deepEqual(manifest.dependencies, generated.versions.reactDependencies)
  assert.equal(manifest.devDependencies.vite, generated.versions.reactViteDevDependencies.vite)
  assert.equal('prettier' in manifest.devDependencies, false)
  for (const script of ['lint', 'lint:fix', 'typecheck', 'test', 'build', 'validate']) {
    assert.ok(script in manifest.scripts, `missing script contract: ${script}`)
  }
  assert.equal(manifest.scripts.postinstall, 'husky', 'Yarn Modern runs postinstall, not prepare')
  assert.equal('prepare' in manifest.scripts, false)

  assert.doesNotMatch(
    readFileSync(resolve(projectDirectory, '.yarnrc.yml'), 'utf8'),
    /fastify/,
    'profile-specific package extensions stay with their profile',
  )

  const record = readFileSync(resolve(projectDirectory, '.engineering-foundation.yml'), 'utf8')
  assert.match(record, /^profiles: \["react-vite"\]$/m)
  assert.match(record, /^workspaces: \{\}$/m)
  assert.match(record, /^accessibility: "WCAG 2\.2 AA"$/m)
  assert.match(readFileSync(resolve(projectDirectory, 'index.html'), 'utf8'), /<html lang="en">/)
})

test('the generated project passes the shared lint gate', () => {
  assert.doesNotThrow(() => run(binary('eslint'), ['.', '--max-warnings=0']))
  assert.doesNotThrow(() => run(binary('depcruise'), ['--config', '.dependency-cruiser.mjs', '.']))
})

test('the generated project typechecks its application and Node configuration', () => {
  assert.doesNotThrow(() => run(binary('tsc'), ['-p', 'tsconfig.app.json']))
  assert.doesNotThrow(() => run(binary('tsc'), ['-p', 'tsconfig.node.json']))
})

test('the generated component tests pass, including the axe-core scan', () => {
  const output = run(binary('vitest'), ['run'])
  assert.match(output, /3 passed/)
})

test('the accessibility helper rejects incomplete axe-core results', () => {
  const probePath = resolve(projectDirectory, 'src/app/incomplete-result.test.ts')
  writeFileSync(
    probePath,
    [
      'import axe, { type AxeResults } from \'axe-core\'',
      'import { expect, it, vi } from \'vitest\'',
      '',
      'import { expectNoAccessibilityViolations } from \'../../test/accessibility\'',
      '',
      'it(\'rejects an axe-core result that still needs manual verification\', async () => {',
      '  vi.spyOn(axe, \'run\').mockResolvedValueOnce({',
      '    violations: [],',
      '    incomplete: [{',
      '      id: \'color-contrast\',',
      '      impact: \'serious\',',
      '      help: \'Elements must meet minimum color contrast ratio thresholds\',',
      '      nodes: [{ target: [\'button\'] }],',
      '    }],',
      '  } as unknown as AxeResults)',
      '',
      '  await expect(expectNoAccessibilityViolations(document.body)).rejects.toThrow(',
      '    /axe-core incomplete results require manual verification/,',
      '  )',
      '})',
      '',
    ].join('\n'),
  )

  try {
    const output = run(binary('vitest'), ['run', 'src/app/incomplete-result.test.ts'])
    assert.match(output, /1 passed/)
  } finally {
    rmSync(probePath, { force: true })
  }
})

test('the generated project builds and keeps the accessible document shell', () => {
  run(binary('vite'), ['build'])
  const html = readFileSync(resolve(projectDirectory, 'dist/index.html'), 'utf8')
  assert.match(html, /<html lang="en">/)
  assert.match(html, /<title>foundation-react-vite-fixture<\/title>/)
  assert.match(html, /<meta name="viewport"/)
})

test('the generated ESLint composition rejects inaccessible JSX with strict rules', async () => {
  const inaccessiblePath = resolve(projectDirectory, 'src/app/Inaccessible.tsx')
  writeFileSync(
    inaccessiblePath,
    [
      'import { type ReactElement } from \'react\'',
      '',
      'export function Inaccessible(): ReactElement {',
      '  return (',
      '    <div onClick={() => undefined}>',
      '      <img src="/logo.png" />',
      '      <a>Missing destination</a>',
      '    </div>',
      '  )',
      '}',
      '',
    ].join('\n'),
  )

  try {
    const eslint = new ESLint({
      cwd: projectDirectory,
      overrideConfigFile: resolve(projectDirectory, 'eslint.config.mjs'),
    })
    const [result] = await eslint.lintFiles([inaccessiblePath])
    const ruleIds = new Set(result.messages.map(({ ruleId }) => ruleId))

    for (const ruleId of [
      'jsx-a11y/alt-text',
      'jsx-a11y/anchor-is-valid',
      'jsx-a11y/click-events-have-key-events',
      'jsx-a11y/no-static-element-interactions',
    ]) {
      assert.ok(ruleIds.has(ruleId), `expected ${ruleId} to fail, got ${[...ruleIds].join(', ')}`)
    }
  } finally {
    rmSync(inaccessiblePath, { force: true })
  }
})

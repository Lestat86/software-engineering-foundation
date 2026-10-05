import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test, { before } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  measureBaselines,
  measureDiffCoverage,
  parseChangedLines,
  runPremerge,
} from '../skills/bootstrap-web-project/assets/tooling/foundation/premerge.mjs'
import { generateProject } from '../skills/bootstrap-web-project/scripts/generate-project.mjs'
import { clearGeneratedDirectory, generatedDirectory } from './helpers/generated-directory.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectDirectory = generatedDirectory('premerge')
const vitest = resolve(repositoryRoot, 'node_modules/.bin/vitest')

const exec = (command, args, cwd, { showOutput = false } = {}) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
    stdio: ['ignore', showOutput ? 'ignore' : 'pipe', 'pipe'],
  })
  return { status: result.status ?? 1, stdout: result.stdout ?? '' }
}

// The fixture is not installed, so `corepack yarn test <args>` is replaced by
// the repository's vitest with the same arguments, as the `test` script would
// run it.
const run = (command, args, cwd, options) => {
  if (command === 'corepack') {
    return exec(vitest, ['run', ...args.slice(2)], cwd, options)
  }
  return exec(command, args, cwd, options)
}

const git = (...args) => {
  const result = exec('git', args, projectDirectory)
  assert.equal(result.status, 0, `git ${args.join(' ')}`)
}

test('changed lines are read from a zero-context diff', () => {
  const diff = [
    'diff --git a/src/a.ts b/src/a.ts',
    '--- a/src/a.ts',
    '+++ b/src/a.ts',
    '@@ -3,0 +4,2 @@ export const a = 1',
    '+line four',
    '+line five',
    '@@ -10 +12 @@',
    '+line twelve',
    'diff --git a/src/b.ts b/src/b.ts',
    '+++ b/src/b.ts',
    '@@ -1,2 +0,0 @@',
  ].join('\n')

  assert.deepEqual(parseChangedLines(diff), new Map([
    ['src/a.ts', new Set([4, 5, 12])],
    ['src/b.ts', new Set()],
  ]))
})

test('diff coverage counts only changed lines that carry a statement', () => {
  const projectRoot = '/project'
  const coverage = {
    '/project/src/a.ts': {
      statementMap: {
        0: { start: { line: 4 } },
        1: { start: { line: 5 } },
        2: { start: { line: 9 } },
      },
      s: { 0: 1, 1: 0, 2: 0 },
    },
  }
  const changedLines = new Map([
    ['src/a.ts', new Set([4, 5, 6])],
    ['src/server.ts', new Set([1])],
  ])

  assert.deepEqual(
    measureDiffCoverage({ changedLines, coverage, projectDirectory: projectRoot }),
    {
      covered: 1,
      total: 2,
      uncovered: [{ file: 'src/a.ts', lines: [5] }],
      unmeasured: ['src/server.ts'],
    },
  )
})

before(() => {
  clearGeneratedDirectory('premerge')
  generateProject({
    targetDirectory: projectDirectory,
    projectName: 'foundation-premerge-fixture',
    profiles: ['fastify'],
  })
  git('init', '--quiet', '--initial-branch=main')
  git('config', 'user.name', 'Foundation Test')
  git('config', 'user.email', 'foundation-test@example.invalid')
  git('add', '.')
  git('commit', '--quiet', '--no-verify', '-m', 'chore: generate project')
  git('switch', '--quiet', '-c', 'feature')
})

test('premerge rejects changed code that no test exercises and passes once it is tested', () => {
  const env = { FOUNDATION_BASE_REF: 'main' }

  appendFileSync(
    resolve(projectDirectory, 'src/features/greetings/routes.ts'),
    [
      '',
      'export const shout = (value: string): string => {',
      '  const loud = value.toUpperCase()',
      '  return loud.concat(\'!\')',
      '}',
      '',
    ].join('\n'),
  )
  git('commit', '--quiet', '--no-verify', '-am', 'feat: add shout')

  const untested = runPremerge({ projectDirectory, run, env })
  assert.equal(untested.errors.length, 1, untested.errors.join('\n'))
  // The declaration runs when the module loads, but the function is never
  // called: its declaration line and its two body lines are all uncovered.
  assert.match(untested.errors[0], /^diff coverage 0\.0% is below 80%$/)
  assert.ok(untested.lines.some((line) => /not covered: src\/features\/greetings\/routes\.ts:\d+,\d+,\d+$/.test(line)))

  writeFileSync(
    resolve(projectDirectory, 'src/features/greetings/shout.test.ts'),
    [
      'import { expect, it } from \'vitest\'',
      '',
      'import { shout } from \'./routes.ts\'',
      '',
      'it(\'shouts\', () => {',
      '  expect(shout(\'hi\')).toBe(\'HI!\')',
      '})',
      '',
    ].join('\n'),
  )
  git('add', '.')
  git('commit', '--quiet', '--no-verify', '-m', 'test: cover shout')

  const tested = runPremerge({ projectDirectory, run, env })
  assert.deepEqual(tested.errors, [])
  assert.deepEqual(tested.warnings, [])
  assert.match(tested.lines[0], /^diff coverage: 100\.0% of 3 changed statement lines against main/)
})

test('premerge reports a missing base and warns about uncommitted changes', () => {
  const missing = runPremerge({ projectDirectory, run, env: { FOUNDATION_BASE_REF: 'origin/absent' } })
  assert.match(missing.errors[0], /base origin\/absent not found/)

  writeFileSync(resolve(projectDirectory, 'NOTES.md'), 'draft\n')
  const dirty = runPremerge({ projectDirectory, run, env: { FOUNDATION_BASE_REF: 'main' } })
  assert.match(dirty.warnings[0], /^uncommitted changes: the result does not describe commit [0-9a-f]{40}$/)
})

test('baselines may shrink or be created, never grow', () => {
  const baselineDirectory = clearGeneratedDirectory('premerge-baseline')
  mkdirSync(baselineDirectory, { recursive: true })
  const suppressions = (count) => JSON.stringify({ 'src/a.ts': { 'no-magic-numbers': { count } } })
  const runWithBase = (stdout) => (command, args) => {
    assert.deepEqual([command, args], ['git', ['show', 'base:eslint-suppressions.json']])
    return stdout === undefined ? { status: 128, stdout: '' } : { status: 0, stdout }
  }
  const measure = (stdout) => measureBaselines({
    mergeBase: 'base',
    projectDirectory: baselineDirectory,
    run: runWithBase(stdout),
  })

  assert.deepEqual(measure(suppressions(1)), [], 'no baseline file, nothing to compare')

  writeFileSync(resolve(baselineDirectory, 'eslint-suppressions.json'), suppressions(2))
  assert.deepEqual(measure(undefined), [{ file: 'eslint-suppressions.json', before: undefined, after: 2 }])
  assert.deepEqual(measure(suppressions(3)), [{ file: 'eslint-suppressions.json', before: 3, after: 2 }])
  assert.deepEqual(measure(suppressions(1)), [{ file: 'eslint-suppressions.json', before: 1, after: 2 }])
})

test('a one-line function that no test calls is not covered by its loaded declaration', () => {
  const coverage = {
    '/project/src/a.ts': {
      statementMap: { 0: { start: { line: 3 } } },
      s: { 0: 1 },
      fnMap: { 0: { loc: { start: { line: 3 } } } },
      f: { 0: 0 },
    },
  }
  const result = measureDiffCoverage({
    changedLines: new Map([['src/a.ts', new Set([3])]]),
    coverage,
    projectDirectory: '/project',
  })
  assert.deepEqual(result.uncovered, [{ file: 'src/a.ts', lines: [3] }])
})

test('premerge fails instead of passing when no coverage report is produced', () => {
  const noReport = (command, args, cwd, options) => {
    if (command === 'corepack') {
      return { status: 0, stdout: '' }
    }
    return exec(command, args, cwd, options)
  }
  const report = runPremerge({ projectDirectory, run: noReport, env: { FOUNDATION_BASE_REF: 'main' } })
  assert.equal(report.errors.length > 0, true)
})

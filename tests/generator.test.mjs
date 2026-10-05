import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const skillRoot = resolve(repositoryRoot, 'skills/bootstrap-web-project')
const generator = resolve(skillRoot, 'scripts/generate-project.mjs')

const runGenerator = (argumentList) => {
  return spawnSync(process.execPath, [generator, ...argumentList], {
    cwd: tmpdir(),
    encoding: 'utf8',
  })
}

const temporaryDirectory = (context) => {
  const directory = mkdtempSync(resolve(tmpdir(), 'foundation-generator-'))
  context.after(() => rmSync(directory, { force: true, recursive: true }))
  return directory
}

test('the skill ships its deterministic scripts as executables', () => {
  for (const script of ['generate-project.mjs', 'ensure-git-root.mjs']) {
    const path = resolve(skillRoot, 'scripts', script)
    assert.ok(existsSync(path), `missing ${script}`)
    assert.match(readFileSync(path, 'utf8'), /^#!\/usr\/bin\/env node\n/)
  }
  assert.equal(existsSync(resolve(repositoryRoot, 'tests/helpers/generate-project.mjs')), false)
})

test('the CLI generates a project into a new directory and reports the composition', (context) => {
  const target = resolve(temporaryDirectory(context), 'api')
  const result = runGenerator([
    '--target', target,
    '--name', 'cli-fixture',
    '--profile', 'fastify',
    '--profile', 'supabase',
    '--ci', 'gitlab',
    '--security-level', 'R2',
    '--security-rationale', 'Authenticated API.',
  ])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /^generated /m)
  assert.match(result.stdout, /^profiles: fastify, supabase$/m)
  assert.match(result.stdout, /^security: R2; ci: gitlab; workflow: assisted$/m)
  assert.ok(existsSync(resolve(target, 'src/app.ts')))
  assert.ok(existsSync(resolve(target, 'supabase/migrations/20260910120000_profiles.sql')))
  assert.ok(existsSync(resolve(target, '.gitlab-ci.yml')))
  const manifest = readFileSync(resolve(target, '.engineering-foundation.yml'), 'utf8')
  assert.match(manifest, /^security:\n {2}level: "R2"\n {2}rationale: "Authenticated API\."$/m)
  assert.match(manifest, /^ci: "gitlab"$/m)
  assert.match(manifest, /^workflow: "assisted"$/m)
})

test('the CLI accepts a freshly initialized Git repository as target', (context) => {
  const target = temporaryDirectory(context)
  mkdirSync(resolve(target, '.git'))

  const result = runGenerator(['--target', target, '--name', 'git-ready', '--profile', 'nest'])

  assert.equal(result.status, 0, result.stderr)
  assert.ok(existsSync(resolve(target, 'src/main.ts')))
})

test('the CLI refuses a non-empty target without touching it', (context) => {
  const target = temporaryDirectory(context)
  const existing = resolve(target, 'notes.md')
  writeFileSync(existing, 'keep me\n')

  const result = runGenerator(['--target', target, '--name', 'busy', '--profile', 'react-vite'])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /target directory is not empty/)
  assert.match(result.stderr, /notes\.md/)
  assert.equal(readFileSync(existing, 'utf8'), 'keep me\n')
  assert.equal(existsSync(resolve(target, 'package.json')), false)
})

test('the CLI validates its composition before writing anything', (context) => {
  const base = temporaryDirectory(context)
  const cases = [
    [['--name', 'x', '--profile', 'monorepo', '--client', 'react-vite'], /requires a server workspace/],
    [['--name', 'x', '--profile', 'fastify', '--server', 'nest'], /require the monorepo profile/],
    [['--name', 'x', '--profile', 'angular'], /unknown profile angular/],
    [['--name', 'x', '--profile', 'fastify', '--ci', 'jenkins'], /unknown CI profile jenkins/],
    [['--name', 'x', '--profile', 'fastify', '--security-level', 'R9'], /R1, R2 or R3/],
    [['--name', 'Bad Name', '--profile', 'fastify'], /lowercase package name/],
    [['--profile', 'fastify'], /--target, --name and at least one --profile/],
  ]

  for (const [index, [argumentList, expected]] of cases.entries()) {
    const target = resolve(base, `case-${index}`)
    const withTarget = argumentList.includes('--profile') && argumentList.includes('--name')
      ? ['--target', target, ...argumentList]
      : argumentList
    const result = runGenerator(withTarget)

    assert.notEqual(result.status, 0, `case ${index} should fail`)
    assert.match(result.stderr, expected)
    assert.equal(existsSync(target), false, `case ${index} must not create the target`)
  }
})

test('the CLI prints usage on --help', () => {
  const result = runGenerator(['--help'])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /^usage: generate-project\.mjs/)
})

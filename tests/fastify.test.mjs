import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test, { before } from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateProject } from '../skills/bootstrap-web-project/scripts/generate-project.mjs'
import { clearGeneratedDirectory, generatedDirectory } from './helpers/generated-directory.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectDirectory = generatedDirectory('fastify')
const binary = (name) => resolve(repositoryRoot, 'node_modules/.bin', name)

const run = (command, args, options = {}) => {
  return execFileSync(command, args, {
    cwd: projectDirectory,
    encoding: 'utf8',
    env: { ...process.env, CI: '1', NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  })
}

let generated

before(() => {
  clearGeneratedDirectory('fastify')
  generated = generateProject({
    targetDirectory: projectDirectory,
    projectName: 'foundation-fastify-fixture',
    profiles: ['fastify'],
  })
})

test('the generated Fastify project is complete and fully resolved', () => {
  for (const file of [
    '.config/eslint/typescript.mjs',
    '.config/typescript/tsconfig.node.json',
    '.env.example',
    '.engineering-foundation.yml',
    '.husky/pre-commit',
    '.secretlintrc.json',
    '.dependency-cruiser.mjs',
    'knip.config.js',
    '.github/pull_request_template.md',
    '.gitlab/merge_request_templates/Default.md',
    'eslint.config.mjs',
    'src/app.ts',
    'src/config.constants.ts',
    'src/config.ts',
    'src/features/greetings/greetings.constants.ts',
    'src/http.constants.ts',
    'src/plugins/error-handler.ts',
    'src/plugins/security.ts',
    'src/server.ts',
    'tsconfig.build.json',
    'vitest.config.ts',
  ]) {
    assert.ok(existsSync(resolve(projectDirectory, file)), `missing generated file: ${file}`)
  }

  assert.equal(
    existsSync(resolve(projectDirectory, '.config/eslint/react.mjs')),
    false,
    'backend projects must not copy the React ESLint module',
  )

  const manifest = JSON.parse(readFileSync(resolve(projectDirectory, 'package.json'), 'utf8'))
  assert.equal(manifest.type, 'module')
  assert.deepEqual(manifest.dependencies, generated.versions.fastifyDependencies)
  assert.equal(manifest.devDependencies.vitest, generated.versions.fastifyDevDependencies.vitest)
  for (const script of ['dev', 'start', 'lint', 'lint:fix', 'typecheck', 'test', 'build', 'validate']) {
    assert.ok(script in manifest.scripts, `missing script contract: ${script}`)
  }

  const envExample = readFileSync(resolve(projectDirectory, '.env.example'), 'utf8')
  assert.doesNotMatch(envExample, /(KEY|SECRET|TOKEN|PASSWORD)=\S/i)

  const yarnrc = readFileSync(resolve(projectDirectory, '.yarnrc.yml'), 'utf8')
  assert.equal(yarnrc.match(/^packageExtensions:$/gm)?.length, 1, 'one packageExtensions section')
  assert.match(yarnrc, /^ {2}"@commitlint\/load@\*":$/m)
  assert.match(yarnrc, /^ {2}fastify-type-provider-zod@\*:$/m)
})

test('the generated Fastify project passes the shared lint gate', () => {
  assert.doesNotThrow(() => run(binary('eslint'), ['.', '--max-warnings=0']))
  assert.doesNotThrow(() => run(binary('depcruise'), ['--config', '.dependency-cruiser.mjs', '.']))
})

test('the generated Fastify project scans committable files for secrets without printing them', async (context) => {
  const scan = () => spawnSync(binary('secretlint'), ['--secretlintignore', '.gitignore', '**/*'], {
    cwd: projectDirectory,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  })
  // Built at runtime so that no token-shaped value is ever committed here.
  const token = `ghp_${'a'.repeat(36)}`
  const leakPath = resolve(projectDirectory, 'leaked-token.txt')
  const ignoredPath = resolve(projectDirectory, '.env')
  context.after(() => {
    rmSync(leakPath, { force: true })
    rmSync(ignoredPath, { force: true })
  })

  assert.equal(scan().status, 0, 'the generated templates contain no secret')

  writeFileSync(ignoredPath, `GITHUB_TOKEN=${token}\n`)
  assert.equal(scan().status, 0, 'a file Git ignores cannot be committed and is not scanned')

  const examplePath = resolve(projectDirectory, 'EXAMPLE.md')
  context.after(() => rmSync(examplePath, { force: true }))
  writeFileSync(examplePath, `<!-- secretlint-disable-next-line -->\nexport TOKEN=${token}\n`)
  assert.equal(scan().status, 0, 'a documented example marked with a comment is not reported')

  writeFileSync(leakPath, `token = "${token}"\n`)
  const result = scan()
  assert.equal(result.status, 1, 'a committable token fails the scan')
  assert.match(result.stdout, /GITHUB_TOKEN/)
  assert.equal(`${result.stdout}${result.stderr}`.includes(token), false, 'the finding is masked')

  const lintStaged = await import(resolve(projectDirectory, 'lint-staged.config.mjs'))
  assert.equal(lintStaged.default['*'], 'secretlint', 'every staged file is scanned')
  assert.equal(
    JSON.parse(readFileSync(resolve(projectDirectory, 'package.json'), 'utf8')).scripts['lint:secrets'],
    'secretlint --secretlintignore .gitignore "**/*"',
  )
})

test('the generated Fastify project typechecks', () => {
  assert.doesNotThrow(() => run(binary('tsc'), ['-p', 'tsconfig.json']))
})

test('the generated Fastify tests cover validation, limits and the error contract', () => {
  const output = run(binary('vitest'), ['run'])
  assert.match(output, /10 passed/)
})

test('the generated Fastify project builds and boots without a configured environment', () => {
  run(binary('tsc'), ['-p', 'tsconfig.build.json'])
  assert.ok(existsSync(resolve(projectDirectory, 'dist/server.js')))
  assert.doesNotMatch(readFileSync(resolve(projectDirectory, 'dist/app.js'), 'utf8'), /\.ts'/)

  const output = run(
    process.execPath,
    ['--input-type=module', '-e', [
      'import { buildApp } from "./dist/app.js"',
      'import { loadConfig } from "./dist/config.js"',
      'const app = await buildApp({ config: loadConfig({ PORT: "0", LOG_LEVEL: "silent" }), logger: false })',
      'const address = await app.listen({ host: "127.0.0.1", port: 0 })',
      'const response = await fetch(address + "/health")',
      'console.log(response.status, await response.text())',
      'await app.close()',
    ].join('\n')],
  )
  assert.match(output, /^200 \{"status":"ok"\}/)
})

test('the generated Fastify configuration fails fast without leaking values', () => {
  const output = run(
    process.execPath,
    ['--input-type=module', '-e', [
      'import { loadConfig } from "./dist/config.js"',
      'try { loadConfig({ PORT: "not-a-port", CORS_ORIGINS: "javascript:alert(1)" }) }',
      'catch (error) { console.log(error.message) }',
    ].join('\n')],
  )
  assert.match(output, /Invalid configuration for: /)
  assert.match(output, /PORT/)
  assert.match(output, /CORS_ORIGINS/)
  assert.doesNotMatch(output, /not-a-port|javascript:/)
})

test('the pull and merge request templates ask for the premerge attestation', () => {
  for (const template of [
    '.github/pull_request_template.md',
    '.gitlab/merge_request_templates/Default.md',
  ]) {
    const content = readFileSync(resolve(projectDirectory, template), 'utf8')
    assert.match(content, /^- \[ \] `corepack yarn premerge` passed on commit `<sha>`/m, template)
    assert.match(content, /SEC-RISK-003/, template)
  }
})

test('the generated Fastify project reports unused exports and dependencies', (context) => {
  const knip = () => spawnSync(binary('knip'), ['--no-progress'], {
    cwd: projectDirectory,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  })
  const unusedPath = resolve(projectDirectory, 'src/features/greetings/unused.ts')
  context.after(() => rmSync(unusedPath, { force: true }))

  const clean = knip()
  assert.equal(clean.status, 0, clean.stdout)
  assert.doesNotMatch(clean.stdout, /Configuration hints/, 'no ignore entry is unnecessary')

  writeFileSync(unusedPath, 'export const forgotten = (): string => \'never imported\'\n')
  const dirty = knip()
  assert.equal(dirty.status, 1)
  assert.match(dirty.stdout, /Unused files \(1\)\nsrc\/features\/greetings\/unused\.ts/)
})

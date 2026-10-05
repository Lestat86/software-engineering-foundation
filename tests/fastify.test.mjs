import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
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
})

test('the generated Fastify project typechecks', () => {
  assert.doesNotThrow(() => run(binary('tsc'), ['-p', 'tsconfig.json']))
})

test('the generated Fastify tests cover validation, limits and the error contract', () => {
  const output = run(binary('vitest'), ['run'])
  assert.match(output, /6 passed/)
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

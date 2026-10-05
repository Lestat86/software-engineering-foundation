import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test, { before } from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateProject } from '../skills/bootstrap-web-project/scripts/generate-project.mjs'
import { clearGeneratedDirectory, generatedDirectory } from './helpers/generated-directory.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectDirectory = generatedDirectory('nest')
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
  clearGeneratedDirectory('nest')
  generated = generateProject({
    targetDirectory: projectDirectory,
    projectName: 'foundation-nest-fixture',
    profiles: ['nest'],
    securityLevel: 'R2',
    securityRationale: 'Representative authenticated API handling business data.',
  })
})

test('the generated Nest project is complete and fully resolved', () => {
  for (const file of [
    '.config/eslint/typescript.mjs',
    '.env.example',
    '.engineering-foundation.yml',
    'nest-cli.json',
    'src/app.module.ts',
    'src/app.setup.ts',
    'src/common/stable-error.filter.ts',
    'src/config/env.constants.ts',
    'src/config/env.ts',
    'src/greetings/greetings.constants.ts',
    'src/main.ts',
    'test/app.e2e.test.ts',
    'tsconfig.build.json',
    'vitest.config.mts',
  ]) {
    assert.ok(existsSync(resolve(projectDirectory, file)), `missing generated file: ${file}`)
  }

  assert.equal(
    existsSync(resolve(projectDirectory, '.config/eslint/react.mjs')),
    false,
    'backend projects must not copy the React ESLint module',
  )

  const manifest = JSON.parse(readFileSync(resolve(projectDirectory, 'package.json'), 'utf8'))
  assert.equal(manifest.type, undefined, 'Nest 11 projects stay CommonJS')
  assert.deepEqual(manifest.dependencies, generated.versions.nestDependencies)
  assert.deepEqual(manifest.resolutions, generated.versions.nestResolutions)
  for (const script of ['dev', 'start', 'lint', 'lint:fix', 'typecheck', 'test', 'build', 'validate']) {
    assert.ok(script in manifest.scripts, `missing script contract: ${script}`)
  }
  assert.match(
    readFileSync(resolve(projectDirectory, '.engineering-foundation.yml'), 'utf8'),
    /^ {2}level: "R2"$/m,
  )
})

test('the generated Nest project passes the shared lint gate', () => {
  assert.doesNotThrow(() => run(binary('eslint'), ['.', '--max-warnings=0']))
})

test('the generated Nest project typechecks', () => {
  assert.doesNotThrow(() => run(binary('tsc'), ['-p', 'tsconfig.json']))
})

test('the generated Nest tests cover validation, throttling and the error contract', () => {
  const output = run(binary('vitest'), ['run'])
  assert.match(output, /6 passed/)
})

test('the generated Nest project builds with the Nest CLI and boots', () => {
  run(binary('nest'), ['build'])
  assert.ok(existsSync(resolve(projectDirectory, 'dist/main.js')))

  const output = run(process.execPath, ['-e', [
    'const { NestFactory } = require("@nestjs/core")',
    'const { AppModule } = require("./dist/app.module.js")',
    'const { configureApp } = require("./dist/app.setup.js")',
    'void (async () => {',
    '  const app = await NestFactory.create(AppModule, { logger: false })',
    '  configureApp(app)',
    '  await app.listen(0, "127.0.0.1")',
    '  const response = await fetch((await app.getUrl()) + "/health")',
    '  console.log(response.status, await response.text())',
    '  await app.close()',
    '})()',
  ].join('\n')])
  assert.match(output, /^200 \{"status":"ok"\}/)
})

test('the Multer security resolution remains compatible with Nest file interceptors', () => {
  const output = run(process.execPath, ['-e', [
    'require("reflect-metadata")',
    'const { Controller, Module, Post, UploadedFile, UseInterceptors } = require("@nestjs/common")',
    'const { NestFactory } = require("@nestjs/core")',
    'const { FileInterceptor } = require("@nestjs/platform-express")',
    'const request = require("supertest")',
    'const multerVersion = require("multer/package.json").version',
    'class UploadController { upload(file) { return { name: file.originalname, size: file.size } } }',
    'const descriptor = Object.getOwnPropertyDescriptor(UploadController.prototype, "upload")',
    'Post("test-upload")(UploadController.prototype, "upload", descriptor)',
    'UseInterceptors(FileInterceptor("file"))(UploadController.prototype, "upload", descriptor)',
    'UploadedFile()(UploadController.prototype, "upload", 0)',
    'Controller()(UploadController)',
    'class UploadModule {}',
    'Module({ controllers: [UploadController] })(UploadModule)',
    'void (async () => {',
    '  const app = await NestFactory.create(UploadModule, { logger: false })',
    '  await app.init()',
    '  const response = await request(app.getHttpServer())',
    '    .post("/test-upload")',
    '    .attach("file", Buffer.from("safe"), "proof.txt")',
    '  console.log(multerVersion, response.status, JSON.stringify(response.body))',
    '  await app.close()',
    '})()',
  ].join('\n')])

  assert.match(output, /^2\.3\.0 201 \{"name":"proof\.txt","size":4\}/)
})

test('the generated Nest configuration fails fast without leaking values', () => {
  const output = run(process.execPath, ['-e', [
    'const { validateEnv } = require("./dist/config/env.js")',
    'try { validateEnv({ PORT: "not-a-port", CORS_ORIGINS: "javascript:alert(1)" }) }',
    'catch (error) { console.log(error.message) }',
  ].join('\n')])
  assert.match(output, /Invalid configuration for: /)
  assert.match(output, /PORT/)
  assert.match(output, /CORS_ORIGINS/)
  assert.doesNotMatch(output, /not-a-port|javascript:/)
})

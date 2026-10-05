import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test, { before } from 'node:test'

import { generateProject, readVersions } from '../skills/bootstrap-web-project/scripts/generate-project.mjs'
import { clearGeneratedDirectory, generatedDirectory } from './helpers/generated-directory.mjs'

const withCi = generatedDirectory('fastify-gitlab-ci')
const withoutCi = generatedDirectory('fastify')

before(() => {
  clearGeneratedDirectory('fastify-gitlab-ci')
  generateProject({
    targetDirectory: withCi,
    projectName: 'foundation-gitlab-ci-fixture',
    profiles: ['fastify'],
    ci: 'gitlab',
  })
})

test('GitLab CI is generated only when selected and recorded in the manifest', () => {
  assert.ok(existsSync(resolve(withCi, '.gitlab-ci.yml')))
  assert.match(readFileSync(resolve(withCi, '.engineering-foundation.yml'), 'utf8'), /^ci: "gitlab"$/m)

  if (existsSync(withoutCi)) {
    assert.equal(existsSync(resolve(withoutCi, '.gitlab-ci.yml')), false)
  }
})

test('the pipeline runs the complete gate reproducibly on the pinned Node major', () => {
  const pipeline = readFileSync(resolve(withCi, '.gitlab-ci.yml'), 'utf8')
  const { nodeMajor } = readVersions().runtime

  assert.match(pipeline, new RegExp(`^image: node:${nodeMajor}-[a-z-]+$`, 'm'))
  assert.match(pipeline, /^ +- corepack enable$/m)
  assert.match(pipeline, /^ +- corepack yarn install --immutable$/m)
  for (const script of ['lint', 'typecheck', 'test', 'build']) {
    assert.match(pipeline, new RegExp(`^${script}:\\n  stage: verify\\n  script:\\n    - corepack yarn ${script}$`, 'm'))
  }
  assert.match(pipeline, /^ +HUSKY: "0"$/m)
  assert.match(pipeline, /merge_request_event/)
  assert.doesNotMatch(pipeline, /\{\{[A-Z_]+\}\}/, 'unresolved placeholder')
})

test('the pipeline contains no deployment logic and never prints the environment', () => {
  const pipeline = readFileSync(resolve(withCi, '.gitlab-ci.yml'), 'utf8')
  const scriptLines = pipeline.split('\n').filter((line) => /^ +- /.test(line))

  for (const line of scriptLines) {
    assert.doesNotMatch(line, /\b(env|printenv|export|set -x|echo \$)\b/, `unsafe command: ${line}`)
    assert.doesNotMatch(line, /\bnpx\b|\bnpm\b|\bpnpm\b/, `foreign package manager: ${line}`)
  }
  assert.doesNotMatch(pipeline, /^ *environment:/m, 'no GitLab environments')
  assert.doesNotMatch(pipeline, /^[a-z_-]*(deploy|release|publish)[a-z_-]*:/im, 'no deployment jobs')
})

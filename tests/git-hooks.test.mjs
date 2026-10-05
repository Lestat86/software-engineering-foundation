import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, realpathSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateProject } from '../skills/bootstrap-web-project/scripts/generate-project.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ensureGitRoot = resolve(
  repositoryRoot,
  'skills/bootstrap-web-project/scripts/ensure-git-root.mjs',
)
const husky = resolve(repositoryRoot, 'node_modules/.bin/husky')

const run = (command, arguments_, cwd) => {
  const result = spawnSync(command, arguments_, {
    cwd,
    encoding: 'utf8',
  })

  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr || result.stdout)

  return result.stdout.trim()
}

test('a generated project owns and activates its Git hooks even inside a parent repository', (context) => {
  const temporaryDirectory = mkdtempSync(resolve(tmpdir(), 'foundation-git-hooks-'))
  const parentDirectory = resolve(temporaryDirectory, 'parent')
  const projectDirectory = resolve(parentDirectory, 'project')

  context.after(() => rmSync(temporaryDirectory, { force: true, recursive: true }))
  mkdirSync(parentDirectory)
  run('git', ['init', '--quiet'], parentDirectory)

  generateProject({
    targetDirectory: projectDirectory,
    projectName: 'git-hooks-fixture',
    profiles: ['fastify'],
  })

  run(process.execPath, [ensureGitRoot, projectDirectory], repositoryRoot)

  assert.equal(
    realpathSync(run('git', ['rev-parse', '--show-toplevel'], projectDirectory)),
    realpathSync(projectDirectory),
  )
  assert.equal(
    realpathSync(run('git', ['rev-parse', '--show-toplevel'], parentDirectory)),
    realpathSync(parentDirectory),
  )

  run(husky, [], projectDirectory)

  assert.equal(run('git', ['config', '--local', '--get', 'core.hooksPath'], projectDirectory), '.husky/_')
  assert.ok(statSync(resolve(projectDirectory, '.husky/_/h')).isFile())
  assert.ok(statSync(resolve(projectDirectory, '.husky/_/pre-commit')).mode & 0o100)

  const parentHooksPath = spawnSync(
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- Git from the user's PATH
    'git',
    ['config', '--local', '--get', 'core.hooksPath'],
    { cwd: parentDirectory, encoding: 'utf8' },
  )
  assert.equal(parentHooksPath.status, 1, 'Husky must not configure the parent repository')
})

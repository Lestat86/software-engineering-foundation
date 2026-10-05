import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { findHookBypass } from '../hooks/block-no-verify.mjs'
import { runStopGate } from '../hooks/stop-gate.mjs'
import { clearGeneratedDirectory } from './helpers/generated-directory.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('commands that skip the Git hooks are recognized, ordinary ones are not', () => {
  const blocked = [
    'git commit --no-verify -m "feat: x"',
    'git commit -n -m "feat: x"',
    'git commit -anm "feat: x"',
    'git -C app push --no-verify origin main',
    'yarn lint && git commit --no-verify -m wip',
    'HUSKY=0 git commit -m "feat: x"',
    'git rebase --no-verify main',
  ]
  const allowed = [
    'git commit -m "feat: add the -n option and --no-verify docs"',
    'git commit -am "fix: x"',
    'git log -n 5',
    'git push origin main',
    'grep -rn "--no-verify" docs',
    'corepack yarn validate',
  ]

  for (const command of blocked) {
    assert.notEqual(findHookBypass(command), undefined, command)
  }
  for (const command of allowed) {
    assert.equal(findHookBypass(command), undefined, command)
  }
})

test('the PreToolUse hook blocks with exit code 2 and explains why', () => {
  const script = resolve(repositoryRoot, 'hooks/block-no-verify.mjs')
  const hook = (command) => spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
  })

  const blocked = hook('git commit --no-verify -m wip')
  assert.equal(blocked.status, 2)
  assert.match(blocked.stderr, /\(GIT-BYPASS-001\): --no-verify skips the hooks of git commit\./)

  const allowed = hook('git commit -m "feat: x"')
  assert.equal(allowed.status, 0)
  assert.equal(allowed.stderr, '')
})

test('the stop gate runs once per changed state and reports failures to the agent', () => {
  const projectDirectory = clearGeneratedDirectory('stop-gate')
  mkdirSync(projectDirectory, { recursive: true })
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- Git from the user's PATH
  const git = (...args) => spawnSync('git', args, { cwd: projectDirectory, encoding: 'utf8' })
  git('init', '--quiet')
  writeFileSync(resolve(projectDirectory, '.engineering-foundation.yml'), 'workflow: "assisted"\n')
  writeFileSync(resolve(projectDirectory, 'app.ts'), 'export const a = 1\n')

  const runs = []
  const runner = (status) => (command) => {
    runs.push(command)
    return { status, output: 'error: lint failed\n' }
  }
  const gate = (status, input = {}, env = {}) => runStopGate({
    env,
    input,
    projectDirectory,
    run: runner(status),
  })

  const failed = gate(1)
  assert.equal(failed.blocked, true)
  assert.match(failed.reason, /^`corepack yarn validate` failed\. Fix the cause before finishing:\nerror: lint failed$/)

  assert.deepEqual(gate(1, { stop_hook_active: true }), { blocked: false, reason: 'skipped' })
  assert.deepEqual(gate(0), { blocked: false, reason: 'passed' })
  assert.deepEqual(gate(1), { blocked: false, reason: 'unchanged since the gate last passed' })
  assert.equal(runs.length, 2, 'an unchanged state does not run the gate again')

  writeFileSync(resolve(projectDirectory, 'app.ts'), 'export const a = 2\n')
  assert.equal(gate(1).blocked, true, 'a new change runs the gate again')
  assert.equal(gate(1).blocked, true, 'a second stop on the same failure is blocked too')
  assert.deepEqual(gate(1), {
    blocked: false,
    reason: 'still failing; left to the person to resolve',
  }, 'a third stop is let through, so an unfixable failure never loops')

  assert.deepEqual(gate(1, {}, { SEF_STOP_GATE: 'off' }), { blocked: false, reason: 'skipped' })
  writeFileSync(resolve(projectDirectory, 'app.ts'), 'export const a = 3\n')
  assert.equal(gate(0, {}, { SEF_STOP_GATE_COMMAND: 'corepack yarn lint' }).reason, 'passed')
  assert.equal(runs.at(-1), 'corepack yarn lint')
})

test('the stop gate ignores directories that are not foundation projects', () => {
  const projectDirectory = clearGeneratedDirectory('stop-gate-foreign')
  mkdirSync(projectDirectory, { recursive: true })

  assert.deepEqual(
    runStopGate({ input: {}, projectDirectory, run: () => assert.fail('must not run') }),
    { blocked: false, reason: 'not a foundation project' },
  )
})

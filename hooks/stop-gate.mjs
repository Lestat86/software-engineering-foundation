#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

// The end-of-turn gate: when an agent stops after changing a generated
// project, run its quality gate once and send the failures back. Claude Code
// runs this as a Stop hook; exit code 2 keeps the agent working.

const BLOCK_EXIT_CODE = 2
const REPORTED_OUTPUT_LINES = 40
const MANIFEST_FILE = '.engineering-foundation.yml'
const DEFAULT_GATE = 'corepack yarn validate'
// After this many blocks on the same unchanged state the agent may stop, so a
// failure it cannot fix never traps it in a loop.
const MAX_BLOCKS_PER_STATE = 2

const git = (projectDirectory, args) => {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- Git from the user's PATH by design
  const result = spawnSync('git', args, { cwd: projectDirectory, encoding: 'utf8' })
  return result.status === 0 ? result.stdout : ''
}

/**
 * Identifies the state of the working tree: the commit, the tracked changes
 * and the content of untracked files. The gate runs again only when it differs
 * from the last state that passed.
 */
const fingerprint = (projectDirectory) => {
  const hash = createHash('sha256')
  hash.update(git(projectDirectory, ['rev-parse', 'HEAD']))
  hash.update(git(projectDirectory, ['diff', 'HEAD', '--binary']))
  const untracked = git(projectDirectory, ['ls-files', '--others', '--exclude-standard', '-z'])
  for (const file of untracked.split('\0').filter(Boolean).sort()) {
    hash.update(file)
    hash.update(readFileSync(resolve(projectDirectory, file)))
  }
  return hash.digest('hex')
}

/**
 * Decides whether to run the gate and runs it. `run` executes the gate command
 * and is injectable for tests; `env` supplies `SEF_STOP_GATE` (`off` disables
 * the gate) and `SEF_STOP_GATE_COMMAND`.
 */
export const runStopGate = ({ input, projectDirectory, env = process.env, run }) => {
  if (input.stop_hook_active === true || env.SEF_STOP_GATE === 'off') {
    return { blocked: false, reason: 'skipped' }
  }
  if (!existsSync(resolve(projectDirectory, MANIFEST_FILE))) {
    return { blocked: false, reason: 'not a foundation project' }
  }
  const statePath = git(projectDirectory, ['rev-parse', '--git-path', 'sef-stop-gate']).trim()
  if (statePath === '') {
    return { blocked: false, reason: 'not a Git repository' }
  }
  const stateFile = resolve(projectDirectory, statePath)
  const state = fingerprint(projectDirectory)
  const previous = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {}
  if (previous.passed === state) {
    return { blocked: false, reason: 'unchanged since the gate last passed' }
  }
  const blocks = previous.failed === state ? previous.blocks : 0
  if (blocks >= MAX_BLOCKS_PER_STATE) {
    return { blocked: false, reason: 'still failing; left to the person to resolve' }
  }

  const command = env.SEF_STOP_GATE_COMMAND ?? DEFAULT_GATE
  const result = run(command, projectDirectory)
  if (result.status === 0) {
    writeFileSync(stateFile, JSON.stringify({ passed: state }))
    return { blocked: false, reason: 'passed' }
  }
  writeFileSync(stateFile, JSON.stringify({ failed: state, blocks: blocks + 1 }))
  const output = result.output.trimEnd().split('\n').slice(-REPORTED_OUTPUT_LINES).join('\n')
  return {
    blocked: true,
    reason: `\`${command}\` failed. Fix the cause before finishing:\n${output}`,
  }
}

const defaultRun = (command, cwd) => {
  const result = spawnSync(command, { cwd, encoding: 'utf8', shell: true })
  return { status: result.status ?? 1, output: `${result.stdout}${result.stderr}` }
}

const invokedDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (invokedDirectly) {
  const outcome = runStopGate({
    input: JSON.parse(readFileSync(0, 'utf8')),
    projectDirectory: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
    run: defaultRun,
  })
  if (outcome.blocked) {
    process.stderr.write(`${outcome.reason}\n`)
    process.exitCode = BLOCK_EXIT_CODE
  }
}

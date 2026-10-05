#!/usr/bin/env node

import { existsSync, realpathSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const targetArgument = process.argv[2]

if (targetArgument === undefined) {
  throw new Error('usage: ensure-git-root.mjs <target-directory>')
}

const target = resolve(targetArgument)

if (!existsSync(target) || !statSync(target).isDirectory()) {
  throw new Error(`target directory does not exist: ${target}`)
}

const targetRoot = realpathSync(target)

const runGit = (arguments_, { allowFailure = false } = {}) => {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- Git from the user's PATH by design
  const result = spawnSync('git', arguments_, {
    cwd: targetRoot,
    encoding: 'utf8',
  })

  if (result.error !== undefined) {
    throw result.error
  }
  if (result.status !== 0 && !allowFailure) {
    throw new Error(result.stderr.trim() || `git ${arguments_.join(' ')} failed`)
  }

  return result
}

const currentGitRoot = () => {
  const result = runGit(['rev-parse', '--show-toplevel'], { allowFailure: true })

  if (result.status !== 0) {
    return undefined
  }

  return realpathSync(result.stdout.trim())
}

if (currentGitRoot() !== targetRoot) {
  runGit(['init', '--quiet'])
}

if (currentGitRoot() !== targetRoot) {
  throw new Error(`failed to make target its own Git root: ${targetRoot}`)
}

process.stdout.write(`${targetRoot}\n`)

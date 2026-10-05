#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

// GIT-BYPASS-001: an agent never skips the Git hooks. Claude Code runs this
// before every Bash command; exit code 2 blocks the command and returns the
// reason to the agent.

const HOOKED_SUBCOMMANDS = new Set(['am', 'commit', 'merge', 'push', 'rebase'])
const BLOCK_EXIT_CODE = 2
// Options of `git` itself that take a separate value, such as `-C <dir>`.
const VALUE_OPTIONS = new Set(['-C', '-c'])
const OPTION_WITH_VALUE = 2

const withoutQuotedText = (command) => command.replaceAll(/'[^']*'|"[^"]*"/g, '""')

const subcommandOf = (tokens, gitIndex) => {
  let index = gitIndex + 1
  while (index < tokens.length && tokens[index].startsWith('-')) {
    index += VALUE_OPTIONS.has(tokens[index]) ? OPTION_WITH_VALUE : 1
  }
  return { name: tokens[index], index }
}

// A cluster of short flags, such as `-n` or `-an`, that includes `-n`.
const isShortNoVerify = (token) => {
  const flags = token.slice(1)
  return token.startsWith('-') && !token.startsWith('--') && /^[a-zA-Z]+$/.test(flags)
    && flags.includes('n')
}

const bypassIn = (segment) => {
  const tokens = segment.trim().split(/\s+/).filter(Boolean)
  const gitIndex = tokens.indexOf('git')
  if (gitIndex === -1) {
    return undefined
  }
  if (tokens.slice(0, gitIndex).some((token) => /^HUSKY=0$/.test(token))) {
    return 'HUSKY=0 disables the Git hooks'
  }
  const subcommand = subcommandOf(tokens, gitIndex)
  if (!HOOKED_SUBCOMMANDS.has(subcommand.name)) {
    return undefined
  }
  const options = tokens.slice(subcommand.index + 1)
  if (options.includes('--no-verify')) {
    return `--no-verify skips the hooks of git ${subcommand.name}`
  }
  if (subcommand.name === 'commit' && options.some(isShortNoVerify)) {
    return '-n is --no-verify for git commit and skips its hooks'
  }
  return undefined
}

/** Returns the reason a shell command bypasses the Git hooks, if it does. */
export const findHookBypass = (command) => {
  return withoutQuotedText(command)
    .split(/&&|\|\||;|\||\n/)
    .map(bypassIn)
    .find((reason) => reason !== undefined)
}

const invokedDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (invokedDirectly) {
  const input = JSON.parse(readFileSync(0, 'utf8'))
  const reason = findHookBypass(String(input.tool_input?.command ?? ''))
  if (reason !== undefined) {
    process.stderr.write(
      `Blocked by the foundation (GIT-BYPASS-001): ${reason}. Fix what the hook `
      + 'reports instead of bypassing it.\n',
    )
    process.exitCode = BLOCK_EXIT_CODE
  }
}

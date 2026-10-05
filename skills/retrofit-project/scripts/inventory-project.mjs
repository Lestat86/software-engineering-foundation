#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

// Read-only inventory of an existing project, the first step of a retrofit.
// It never writes to the target. Each signal names the foundation requirement
// it concerns, so the assessment can start from facts instead of impressions.

const CLI_ARGUMENTS_OFFSET = 2
const JSON_INDENT = 2
const SOURCE_EXTENSIONS = new Set(['.cjs', '.js', '.jsx', '.mjs', '.mts', '.cts', '.ts', '.tsx'])
const IGNORED_DIRECTORIES = new Set(['.git', '.next', '.yarn', 'build', 'coverage', 'dist', 'node_modules'])
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/
const DEBT_MARKER = /\b(TODO|FIXME)\b/g
const TRACKED_DEBT_MARKER = /\b(TODO|FIXME)\(#\d+\)/g
const SUSPICIOUS_FILES = [
  { pattern: /(^|\/)\.env(\.(?!example$)[^/]+)?$/, reason: 'environment file', requirement: 'GIT-SECRET-001' },
  { pattern: /\.(pem|key|p12|pfx)$|(^|\/)id_(rsa|ed25519)$/, reason: 'key material', requirement: 'GIT-SECRET-001' },
  { pattern: /\.(zip|tar|tgz|gz|rar|7z)$/, reason: 'archive', requirement: 'hygiene' },
  { pattern: /(^|\/)(backup[^/]*|\.history)\//i, reason: 'backup or editor history', requirement: 'hygiene' },
  { pattern: /(^|\/)node_modules\//, reason: 'installed dependencies', requirement: 'hygiene' },
]
const STACK_PACKAGES = {
  '@black-bytes/eslint-config': 'Black Bytes ESLint config',
  '@capacitor/core': 'Capacitor',
  '@nestjs/core': 'Nest',
  '@playwright/test': 'Playwright',
  '@prisma/client': 'Prisma',
  '@supabase/supabase-js': 'Supabase',
  'express': 'Express',
  'fastify': 'Fastify',
  'jest': 'Jest',
  'next': 'Next.js',
  'prettier': 'Prettier',
  'prisma': 'Prisma',
  'react': 'React',
  'vite': 'Vite',
  'vitest': 'Vitest',
}

const readText = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined)

const readJson = (path) => {
  const text = readText(path)
  return text === undefined ? undefined : JSON.parse(text)
}

// Removes comments outside strings: a path pattern such as "@/*" or
// "src/**/*.ts" contains comment-like sequences that a regular expression
// would cut.
const stripJsonComments = (text) => {
  let result = ''
  let index = 0
  while (index < text.length) {
    const pair = text.slice(index, index + '//'.length)
    if (text[index] === '"') {
      const end = endOfString(text, index)
      result += text.slice(index, end)
      index = end
    } else if (pair === '//') {
      index = text.indexOf('\n', index) === -1 ? text.length : text.indexOf('\n', index)
    } else if (pair === '/*') {
      index = text.indexOf('*/', index) + '*/'.length
    } else {
      result += text[index]
      index += 1
    }
  }
  return result
}

const endOfString = (text, start) => {
  let index = start + 1
  while (index < text.length && text[index] !== '"') {
    index += text[index] === '\\' ? '\\"'.length : 1
  }
  return index + 1
}

// tsconfig files allow comments and trailing commas, which JSON.parse rejects.
const readLooseJson = (path) => {
  const text = readText(path)
  if (text === undefined) {
    return undefined
  }
  try {
    return JSON.parse(stripJsonComments(text).replaceAll(/,(\s*[}\]])/g, '$1'))
  } catch {
    return { unparsed: true }
  }
}

const listFiles = (projectDirectory) => {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- Git from the user's PATH by design
  const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: projectDirectory, encoding: 'utf8' })
  if (tracked.status === 0) {
    return { files: tracked.stdout.split('\0').filter(Boolean), source: 'git' }
  }
  const entriesOf = (directory) => {
    return readdirSync(resolve(projectDirectory, directory), { withFileTypes: true })
  }
  const walk = (directory) => entriesOf(directory)
    .filter((entry) => !IGNORED_DIRECTORIES.has(entry.name))
    .flatMap((entry) => {
      const path = directory === '' ? entry.name : join(directory, entry.name)
      return entry.isDirectory() ? walk(path) : [path]
    })
  return { files: walk(''), source: 'filesystem' }
}

const expandWorkspaces = (projectDirectory, patterns) => {
  return patterns.flatMap((pattern) => {
    if (!pattern.endsWith('/*')) {
      return [pattern]
    }
    const parent = pattern.slice(0, -'/*'.length)
    const parentPath = resolve(projectDirectory, parent)
    return existsSync(parentPath)
      ? readdirSync(parentPath).filter((name) => statSync(resolve(parentPath, name)).isDirectory())
          .map((name) => join(parent, name))
      : []
  }).filter((directory) => existsSync(resolve(projectDirectory, directory, 'package.json')))
}

const describePackages = (projectDirectory) => {
  const root = readJson(resolve(projectDirectory, 'package.json')) ?? {}
  const patterns = Array.isArray(root.workspaces)
    ? root.workspaces
    : root.workspaces?.packages ?? []
  const workspaces = expandWorkspaces(projectDirectory, patterns)
  const dependencies = {}
  for (const directory of ['.', ...workspaces]) {
    const manifest = readJson(resolve(projectDirectory, directory, 'package.json')) ?? {}
    Object.assign(dependencies, manifest.dependencies, manifest.devDependencies)
  }
  return { root, workspaces, dependencies }
}

const describePackageManager = (projectDirectory, root) => {
  const yarnLock = readText(resolve(projectDirectory, 'yarn.lock'))
  let lockfile = 'none'
  if (yarnLock !== undefined) {
    lockfile = yarnLock.includes('__metadata:') ? 'yarn (Modern)' : 'yarn (v1)'
  } else if (existsSync(resolve(projectDirectory, 'package-lock.json'))) {
    lockfile = 'npm'
  } else if (existsSync(resolve(projectDirectory, 'pnpm-lock.yaml'))) {
    lockfile = 'pnpm'
  }
  return { declared: root.packageManager ?? 'none', lockfile }
}

const describeTypeScript = (projectDirectory, packageDirectories) => {
  const flags = ['strict', 'noUncheckedIndexedAccess', 'exactOptionalPropertyTypes']
  return packageDirectories.flatMap((directory) => {
    const path = join(directory, 'tsconfig.json')
    const config = readLooseJson(resolve(projectDirectory, path))
    if (config === undefined) {
      return []
    }
    const base = typeof config.extends === 'string' && config.extends.startsWith('.')
      ? readLooseJson(resolve(projectDirectory, directory, config.extends)) ?? {}
      : {}
    const options = { ...base.compilerOptions, ...config.compilerOptions }
    const enabled = Object.fromEntries(flags.map((flag) => [flag, options[flag] === true]))
    const aliases = Object.entries(options.paths ?? {})
    return [{ path, unparsed: config.unparsed === true, ...enabled, aliases }]
  })
}

const countSource = (projectDirectory, files) => {
  const sources = files.filter((file) => SOURCE_EXTENSIONS.has(extname(file)) && !file.endsWith('.d.ts'))
  const counts = {
    sourceFiles: sources.length,
    testFiles: 0,
    eslintDisable: 0,
    debtMarkers: 0,
    trackedDebtMarkers: 0,
  }
  for (const file of sources) {
    const text = readText(resolve(projectDirectory, file)) ?? ''
    counts.testFiles += TEST_FILE.test(file) ? 1 : 0
    counts.eslintDisable += text.split('eslint-disable').length - 1
    counts.debtMarkers += text.match(DEBT_MARKER)?.length ?? 0
    counts.trackedDebtMarkers += text.match(TRACKED_DEBT_MARKER)?.length ?? 0
  }
  return counts
}

const describeTooling = (projectDirectory, files) => {
  const hook = (name) => readText(resolve(projectDirectory, '.husky', name))?.trim()
  return {
    eslintConfig: files.filter((file) => /^(eslint\.config\.[cm]?[jt]s|\.eslintrc(\.\w+)?)$/.test(file)),
    hooks: { preCommit: hook('pre-commit'), commitMsg: hook('commit-msg') },
    ci: files.filter((file) => /^\.github\/workflows\/[^/]+\.ya?ml$|^\.gitlab-ci\.yml$/.test(file)),
    foundationRecord: existsSync(resolve(projectDirectory, '.engineering-foundation.yml')),
  }
}

// Path aliases and code shared outside any package change how the dependency
// rules run, so they are reported before the retrofit is planned.
const describeAliasSignals = ({ typescript, workspaces }, add) => {
  const aliased = typescript.filter((entry) => entry.aliases.length > 0)
  const aliases = aliased.flatMap((entry) => entry.aliases)
  if (aliases.length > 0) {
    const names = [...new Set(aliases.map(([name]) => name))].join(', ')
    const advice = 'run dependency-cruiser per workspace with its tsconfig (see the retrofit waves)'
    add('STRUCT-BOUNDARY-001', `path aliases ${names}: ${advice}`)
  }
  const outside = new Set(aliases.flatMap(([, targets]) => targets)
    .map((target) => /^\.\.\/([^/]+)\//.exec(target)?.[1])
    .filter((directory) => directory !== undefined && !workspaces.includes(directory)))
  const consequence = 'the dependencies it imports are declared by its consumers, not by itself'
  for (const directory of outside) {
    add('DEP-MINIMAL-001', `${directory}/ is shared through an alias but is not a package: ${consequence}`)
  }
}

/** Maps the inventory to foundation requirements; every signal is a fact to assess. */
const describeSignals = (inventory) => {
  const { counts, packageManager, stack, tooling, typescript, suspicious } = inventory
  const signals = []
  const add = (requirement, finding) => signals.push({ requirement, finding })

  if (stack.includes('Next.js')) {
    add('scope', 'Next.js is outside the foundation scope; only stack-independent requirements apply')
  }
  if (packageManager.lockfile !== 'yarn (Modern)') {
    add('DEP-YARN-001', `package manager is ${packageManager.lockfile}, not Yarn Modern through Corepack`)
  }
  if (stack.includes('Prettier')) {
    add('DEP-ESLINT-001', 'Prettier is installed; ESLint owns formatting')
  }
  if (tooling.eslintConfig.some((file) => file.startsWith('.eslintrc'))) {
    add('DEP-ESLINT-001', 'legacy .eslintrc configuration instead of a flat config')
  }
  if (/\b(tsc|typecheck|test)\b/.test(tooling.hooks.preCommit ?? '')) {
    add('GIT-HOOK-001', `pre-commit runs repository-wide checks: ${tooling.hooks.preCommit.replaceAll('\n', '; ')}`)
  }
  if (/\bnpx\b/.test(`${tooling.hooks.preCommit ?? ''} ${tooling.hooks.commitMsg ?? ''}`)) {
    add('DEP-YARN-001', 'a Git hook runs npx')
  }
  if (tooling.hooks.commitMsg === undefined) {
    add('GIT-MESSAGE-001', 'no commit-msg hook validates Conventional Commits')
  }
  if (tooling.ci.length === 0) {
    add('CI-GATE-001', 'no CI pipeline; premerge with the pull request attestation is the only gate')
  }
  describeAliasSignals(inventory, add)
  const loose = typescript.filter((entry) => !entry.strict || !entry.noUncheckedIndexedAccess)
  for (const config of loose) {
    add('TS-STRICT-001', `${config.path}: strict ${String(config.strict)}, noUncheckedIndexedAccess ${String(config.noUncheckedIndexedAccess)}`)
  }
  if (counts.eslintDisable > 0) {
    add('CORE-SUPPRESS-001', `${String(counts.eslintDisable)} eslint-disable directives to describe or remove`)
  }
  if (counts.debtMarkers > counts.trackedDebtMarkers) {
    add('CORE-DEBT-001', `${String(counts.debtMarkers - counts.trackedDebtMarkers)} TODO/FIXME markers without an issue reference`)
  }
  for (const { file, reason, requirement } of suspicious) {
    add(requirement, `tracked ${reason}: ${file}`)
  }
  add('GIT-SECRET-001', 'scan the whole Git history once for secrets before adopting (see the retrofit waves)')
  return signals
}

/** Builds the inventory of the project at `projectDirectory` without writing to it. */
export const inventoryProject = (projectDirectory) => {
  if (!existsSync(resolve(projectDirectory, 'package.json'))) {
    throw new Error(`no package.json in ${projectDirectory}`)
  }
  const { files, source } = listFiles(projectDirectory)
  const { root, workspaces, dependencies } = describePackages(projectDirectory)
  const inventory = {
    name: root.name ?? 'unnamed',
    fileSource: source,
    workspaces,
    stack: [...new Set(Object.keys(dependencies).filter((name) => name in STACK_PACKAGES)
      .map((name) => STACK_PACKAGES[name]))].sort(),
    packageManager: describePackageManager(projectDirectory, root),
    tooling: describeTooling(projectDirectory, files),
    typescript: describeTypeScript(projectDirectory, ['.', ...workspaces]),
    counts: countSource(projectDirectory, files),
    suspicious: files.flatMap((file) => SUSPICIOUS_FILES
      .filter(({ pattern }) => pattern.test(file))
      .map(({ reason, requirement }) => ({ file, reason, requirement }))
      .slice(0, 1)),
  }
  return { ...inventory, signals: describeSignals(inventory) }
}

/** Renders the inventory as the opening section of a retrofit assessment. */
export const formatInventory = (inventory) => {
  const { counts, packageManager, tooling } = inventory
  return [
    `# Retrofit inventory — ${inventory.name}`,
    '',
    `- Stack: ${inventory.stack.join(', ') || 'not detected'}`,
    `- Workspaces: ${inventory.workspaces.join(', ') || 'none'}`,
    `- Package manager: declared ${packageManager.declared}, lockfile ${packageManager.lockfile}`,
    `- ESLint configuration: ${tooling.eslintConfig.join(', ') || 'none'}`,
    `- Pre-commit hook: ${tooling.hooks.preCommit?.replaceAll('\n', '; ') ?? 'none'}`,
    `- CI: ${tooling.ci.join(', ') || 'none'}`,
    `- Foundation record: ${tooling.foundationRecord ? 'present' : 'absent'}`,
    `- Source files: ${String(counts.sourceFiles)}, of which tests: ${String(counts.testFiles)}`,
    `- eslint-disable directives: ${String(counts.eslintDisable)}`,
    `- TODO/FIXME markers: ${String(counts.debtMarkers)}, with an issue reference: ${String(counts.trackedDebtMarkers)}`,
    `- Files listed from: ${inventory.fileSource}`,
    '',
    '## Signals',
    '',
    '| Requirement | Finding |',
    '| --- | --- |',
    ...inventory.signals.map(({ requirement, finding }) => `| ${requirement} | ${finding} |`),
    '',
  ].join('\n')
}

const invokedDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (invokedDirectly) {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(CLI_ARGUMENTS_OFFSET),
      options: { target: { type: 'string' }, json: { type: 'boolean', default: false } },
    })
    if (values.target === undefined) {
      throw new Error('usage: inventory-project.mjs --target <dir> [--json]')
    }
    const inventory = inventoryProject(resolve(values.target))
    process.stdout.write(values.json
      ? `${JSON.stringify(inventory, null, JSON_INDENT)}\n`
      : formatInventory(inventory))
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}

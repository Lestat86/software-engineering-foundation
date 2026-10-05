#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { parse } from 'yaml'

// The pre-merge gate, run by `corepack yarn premerge` after lint, typecheck and
// build. It measures what a full-repository gate cannot: whether the lines this
// branch changes are exercised by tests (TEST-CHANGE-001, TEST-COVERAGE-001).

const MANIFEST_FILE = '.engineering-foundation.yml'
const COVERAGE_DIRECTORY = 'coverage/premerge'
const PERCENT = 100
const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/
const NEW_FILE_HEADER = /^\+\+\+ b\/(.+)$/

/**
 * Maps every file of a zero-context unified diff to the set of line numbers it
 * adds or changes on the new side.
 */
export const parseChangedLines = (diff) => {
  const changed = new Map()
  let lines

  for (const row of diff.split('\n')) {
    const file = NEW_FILE_HEADER.exec(row)
    if (file !== null) {
      lines = new Set()
      changed.set(file[1], lines)
      continue
    }
    const hunk = HUNK_HEADER.exec(row)
    if (hunk !== null && lines !== undefined) {
      const start = Number(hunk[1])
      const count = hunk[2] === undefined ? 1 : Number(hunk[2])
      for (let offset = 0; offset < count; offset += 1) {
        lines.add(start + offset)
      }
    }
  }
  return changed
}

/**
 * Reduces an Istanbul file coverage to a map from line number to whether any
 * statement starting on that line ran.
 */
const lineHits = (fileCoverage) => {
  const hits = new Map()
  for (const [id, location] of Object.entries(fileCoverage.statementMap)) {
    const line = location.start.line
    hits.set(line, (hits.get(line) ?? false) || fileCoverage.s[id] > 0)
  }
  // A function declared on a line but never called leaves that line uncovered,
  // even though the declaration itself ran when the module loaded.
  for (const [id, fn] of Object.entries(fileCoverage.fnMap ?? {})) {
    if (fileCoverage.f[id] === 0) {
      hits.set(fn.loc.start.line, false)
    }
  }
  return hits
}

const SOURCE_FILE = /\.[cm]?[jt]sx?$/
const TEST_FILE = /((^|\/)(test|e2e)\/)|(\.(test|spec)\.[cm]?[jt]sx?$)/

/**
 * Counts the changed lines that carry a statement and how many of them ran.
 * A changed file absent from the coverage report is outside the coverage scope
 * declared by the test configuration, such as a test or an entry point.
 */
export const measureDiffCoverage = ({ changedLines, coverage, projectDirectory }) => {
  const result = { covered: 0, total: 0, uncovered: [], unmeasured: [] }

  for (const [file, lines] of changedLines) {
    const fileCoverage = coverage[resolve(projectDirectory, file)]
    if (fileCoverage === undefined) {
      if (SOURCE_FILE.test(file) && !TEST_FILE.test(file) && lines.size > 0) {
        result.unmeasured.push(file)
      }
      continue
    }
    const hits = lineHits(fileCoverage)
    const missed = [...lines].filter((line) => hits.has(line) && !hits.get(line))
    const measured = [...lines].filter((line) => hits.has(line)).length

    result.total += measured
    result.covered += measured - missed.length
    if (missed.length > 0) {
      result.uncovered.push({ file, lines: missed.sort((left, right) => left - right) })
    }
  }
  return result
}

// Files that freeze existing violations during a retrofit. Each may shrink,
// never grow: a new violation is fixed, not added to the baseline.
const BASELINES = [
  {
    file: 'eslint-suppressions.json',
    count: (suppressions) => Object.values(suppressions)
      .flatMap((rules) => Object.values(rules))
      .reduce((sum, { count }) => sum + count, 0),
  },
  {
    file: '.dependency-cruiser-known-violations.json',
    count: (violations) => violations.length,
  },
]

/** Compares each baseline at HEAD with its version at the merge base. */
export const measureBaselines = ({ mergeBase, projectDirectory, run }) => {
  return BASELINES.flatMap(({ file, count }) => {
    const path = resolve(projectDirectory, file)
    if (!existsSync(path)) {
      return []
    }
    const base = run('git', ['show', `${mergeBase}:${file}`], projectDirectory)
    return [{
      file,
      before: base.status === 0 ? count(JSON.parse(base.stdout)) : undefined,
      after: count(JSON.parse(readFileSync(path, 'utf8'))),
    }]
  })
}

const reportBaselines = (baselines, report) => {
  for (const { file, before, after } of baselines) {
    if (before === undefined) {
      report.lines.push(`baseline ${file}: created with ${String(after)} entries`)
    } else if (after > before) {
      report.errors.push(
        `baseline ${file} grew from ${String(before)} to ${String(after)}: `
        + 'fix the new violations instead of adding them to the baseline',
      )
    } else {
      report.lines.push(`baseline ${file}: ${String(before)} → ${String(after)}`)
    }
  }
}

const percentage = ({ covered, total }) => (total === 0 ? PERCENT : (covered / total) * PERCENT)

const readCoverage = (projectDirectory, packageDirectories) => {
  const coverage = {}
  for (const directory of packageDirectories) {
    const report = join(projectDirectory, directory, COVERAGE_DIRECTORY, 'coverage-final.json')
    if (existsSync(report)) {
      Object.assign(coverage, JSON.parse(readFileSync(report, 'utf8')))
    }
  }
  return coverage
}

const defaultRun = (command, args, cwd, { showOutput = false } = {}) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', showOutput ? 'inherit' : 'pipe', 'inherit'],
  })
  if (result.error !== undefined) {
    throw result.error
  }
  return { status: result.status ?? 1, stdout: result.stdout ?? '' }
}

const git = (run, cwd, args) => {
  const result = run('git', args, cwd)
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed`)
  }
  return result.stdout.trim()
}

/**
 * Runs the pre-merge checks and returns the report. `run` executes a command
 * and is injectable so the orchestration can be tested without a package
 * manager; `env` supplies `FOUNDATION_BASE_REF`.
 */
export const runPremerge = ({ projectDirectory, run = defaultRun, env = process.env }) => {
  const manifest = parse(readFileSync(resolve(projectDirectory, MANIFEST_FILE), 'utf8'))
  const settings = manifest.premerge
  const baseRef = env.FOUNDATION_BASE_REF ?? settings.baseRef
  const report = { errors: [], warnings: [], lines: [] }

  const head = git(run, projectDirectory, ['rev-parse', 'HEAD'])
  const mergeBase = run('git', ['merge-base', 'HEAD', baseRef], projectDirectory)
  if (mergeBase.status !== 0) {
    report.errors.push(
      `base ${baseRef} not found: fetch it or set FOUNDATION_BASE_REF to the target branch`,
    )
    return { ...report, head }
  }
  reportBaselines(
    measureBaselines({ mergeBase: mergeBase.stdout.trim(), projectDirectory, run }),
    report,
  )
  if (git(run, projectDirectory, ['status', '--porcelain']) !== '') {
    report.warnings.push(`uncommitted changes: the result does not describe commit ${head}`)
  }

  // Reports of an earlier run would let a run that produced none pass, so the
  // directory this script owns is cleared first.
  const packageDirectories = ['.', ...Object.keys(manifest.workspaces ?? {})]
  for (const directory of packageDirectories) {
    rmSync(join(projectDirectory, directory, COVERAGE_DIRECTORY), { force: true, recursive: true })
  }
  const testRun = run('corepack', [
    'yarn',
    'test',
    '--coverage.enabled=true',
    '--coverage.reporter=json',
    `--coverage.reportsDirectory=${COVERAGE_DIRECTORY}`,
  ], projectDirectory, { showOutput: true })
  if (testRun.status !== 0) {
    report.errors.push('tests failed while measuring coverage')
    return { ...report, head }
  }

  const diff = git(run, projectDirectory, [
    'diff', '--relative', '--unified=0', '--no-color', '--diff-filter=AMR',
    mergeBase.stdout.trim(),
  ])
  const coverage = readCoverage(projectDirectory, packageDirectories)
  if (Object.keys(coverage).length === 0) {
    report.errors.push(
      `no coverage report in ${COVERAGE_DIRECTORY}: install @vitest/coverage-v8 at the vitest `
      + 'version of each workspace and set coverage.include in its vitest configuration',
    )
    return { ...report, head }
  }
  const diffCoverage = measureDiffCoverage({
    changedLines: parseChangedLines(diff),
    coverage,
    projectDirectory,
  })
  const measured = percentage(diffCoverage)
  if (diffCoverage.unmeasured.length > 0) {
    report.warnings.push(
      `changed source outside the coverage scope: ${diffCoverage.unmeasured.join(', ')}; `
      + 'check coverage.include if these files should be tested',
    )
  }

  report.lines.push(
    `diff coverage: ${measured.toFixed(1)}% of ${String(diffCoverage.total)} changed `
    + `statement lines against ${baseRef} (minimum ${String(settings.diffCoverage)}%)`,
  )
  if (measured < settings.diffCoverage) {
    for (const { file, lines } of diffCoverage.uncovered) {
      report.lines.push(`  not covered: ${file}:${lines.join(',')}`)
    }
    report.errors.push(`diff coverage ${measured.toFixed(1)}% is below ${String(settings.diffCoverage)}%`)
  }
  return { ...report, head }
}

const invokedDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (invokedDirectly) {
  const report = runPremerge({ projectDirectory: process.cwd() })
  for (const line of report.lines) {
    process.stdout.write(`${line}\n`)
  }
  for (const warning of report.warnings) {
    process.stderr.write(`warning: ${warning}\n`)
  }
  for (const error of report.errors) {
    process.stderr.write(`error: ${error}\n`)
  }
  if (report.errors.length > 0) {
    process.exitCode = 1
  } else {
    process.stdout.write(`premerge: passed on ${report.head}\n`)
  }
}

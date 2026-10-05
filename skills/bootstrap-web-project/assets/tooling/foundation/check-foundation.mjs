#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { parse } from 'yaml'

// RECORD-MANIFEST-001 and RECORD-EXCEPTION-001: the project record and the
// exception register are checked by the lint gate, not by review alone.

const MANIFEST_FILE = '.engineering-foundation.yml'
const EXCEPTIONS_FILE = 'docs/exceptions.yml'
const REQUIREMENTS_FILE = '.config/foundation/requirements.json'

const SECURITY_LEVELS = new Set(['R1', 'R2', 'R3'])
const WORKFLOWS = new Set(['assisted', 'autonomous'])
const CI_PROFILES = new Set(['none', 'gitlab'])
const SEMANTIC_VERSION = /^\d+\.\d+\.\d+$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const REQUIRED_EXCEPTION_FIELDS = ['id', 'scope', 'justification', 'owner', 'expires']
const PERCENT = 100

const FEATURES_DIRECTORY = 'docs/features'
const PLAN_STATUSES = new Set(['draft', 'ready', 'in-progress', 'done'])
const STARTED_STATUSES = new Set(['ready', 'in-progress', 'done'])
const PLAN_SECTIONS = [
  'Goal',
  'Verified context',
  'Decisions',
  'Out of scope',
  'Invariants',
  'Files and commits',
  'Acceptance',
  'Tests',
  'Blocking questions',
  'Changes during implementation',
  'Pull request description',
]
const SETTLED_CRITERION = /(^- \[x\] )|(manual: \S)|(deferred: #\d)/

// Dependencies that bring authentication, payments or identity data: each is an
// R2 trigger, so an R1 project that installs one must be reclassified
// (SEC-RISK-002, SEC-RISK-003). The list is a heuristic and only warns.
const R2_SIGNALS = [
  /^@auth\//,
  /^@nestjs\/passport$/,
  /^@paypal\//,
  /^@supabase\/auth/,
  /^better-auth$/,
  /^jose$/,
  /^jsonwebtoken$/,
  /^keycloak/,
  /^next-auth$/,
  /^passport/,
  /^stripe$/,
]

const isFilled = (value) => typeof value === 'string' && value.trim() !== ''

const isPercentage = (value) => Number.isFinite(value) && value >= 0 && value <= PERCENT

const readYaml = (path) => parse(readFileSync(path, 'utf8'))

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

const toIsoDate = (date) => date.toISOString().split('T')[0]

const isCalendarDate = (value) => {
  return ISO_DATE.test(value)
    && !Number.isNaN(Date.parse(value))
    && toIsoDate(new Date(value)) === value
}

const checkSecurity = (manifest, dependencyNames, report) => {
  const security = manifest.security ?? {}
  if (!SECURITY_LEVELS.has(security.level)) {
    report.errors.push(`${MANIFEST_FILE}: security.level must be R1, R2 or R3`)
  }
  if (!isFilled(security.rationale)) {
    report.errors.push(`${MANIFEST_FILE}: security.rationale must explain the classification`)
  }
  if (security.level === 'R1') {
    const signals = dependencyNames.filter(
      (name) => R2_SIGNALS.some((pattern) => pattern.test(name)),
    )
    if (signals.length > 0) {
      report.warnings.push(
        `${MANIFEST_FILE}: R1 excludes authentication and payments, but ${signals.join(', ')} `
        + 'suggest an R2 trigger; reassess the classification (SEC-RISK-003)',
      )
    }
  }
}

const checkPremerge = (manifest, report) => {
  const premerge = manifest.premerge ?? {}
  if (!isFilled(premerge.baseRef)) {
    report.errors.push(`${MANIFEST_FILE}: premerge.baseRef must name the target branch`)
  }
  if (!isPercentage(premerge.diffCoverage)) {
    report.errors.push(`${MANIFEST_FILE}: premerge.diffCoverage must be a percentage`)
  }
}

const checkManifest = (projectDirectory, report) => {
  const manifestPath = resolve(projectDirectory, MANIFEST_FILE)
  if (!existsSync(manifestPath)) {
    report.errors.push(`${MANIFEST_FILE} is missing`)
    return
  }

  const manifest = readYaml(manifestPath) ?? {}
  const packageJson = readJson(resolve(projectDirectory, 'package.json'))
  const dependencyNames = Object.keys({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  })

  if (!SEMANTIC_VERSION.test(String(manifest.foundationVersion))) {
    report.errors.push(`${MANIFEST_FILE}: foundationVersion must be a semantic version`)
  }
  if (!Array.isArray(manifest.profiles) || !manifest.profiles.every(isFilled)
    || manifest.profiles.length === 0) {
    report.errors.push(`${MANIFEST_FILE}: profiles must list the applied profiles`)
  }
  if (!WORKFLOWS.has(manifest.workflow)) {
    report.errors.push(`${MANIFEST_FILE}: workflow must be assisted or autonomous`)
  }
  if (!CI_PROFILES.has(manifest.ci)) {
    report.errors.push(`${MANIFEST_FILE}: ci must be none or gitlab`)
  }
  if (manifest.packageManager !== packageJson.packageManager) {
    report.errors.push(
      `${MANIFEST_FILE}: packageManager ${String(manifest.packageManager)} does not match `
      + `package.json ${String(packageJson.packageManager)}`,
    )
  }
  checkSecurity(manifest, dependencyNames, report)
  checkPremerge(manifest, report)
}

const checkException = (entry, position, context) => {
  const { report, requirements, today } = context
  const label = `${EXCEPTIONS_FILE}: exception ${position}`
  const missing = REQUIRED_EXCEPTION_FIELDS.filter((field) => !isFilled(String(entry[field] ?? '')))

  if (missing.length > 0) {
    report.errors.push(`${label} is missing ${missing.join(', ')}`)
    return
  }
  if (requirements !== undefined && !(entry.id in requirements)) {
    report.errors.push(`${label} references unknown requirement ${entry.id}`)
  }

  const expires = String(entry.expires)
  if (!isCalendarDate(expires)) {
    report.errors.push(`${label} (${entry.id}) has an invalid expires date ${expires}`)
  } else if (expires < today) {
    report.errors.push(
      `${label} (${entry.id}) expired on ${expires}: review it, then renew or remove it`,
    )
  }
}

const checkExceptions = (projectDirectory, today, report) => {
  const exceptionsPath = resolve(projectDirectory, EXCEPTIONS_FILE)
  if (!existsSync(exceptionsPath)) {
    return
  }

  const register = readYaml(exceptionsPath) ?? {}
  if (!Array.isArray(register.exceptions)) {
    report.errors.push(`${EXCEPTIONS_FILE}: exceptions must be a list`)
    return
  }

  const requirementsPath = resolve(projectDirectory, REQUIREMENTS_FILE)
  const requirements = existsSync(requirementsPath) ? readJson(requirementsPath) : undefined
  const context = { report, requirements, today }

  register.exceptions.forEach((entry, index) => {
    checkException(entry ?? {}, index + 1, context)
  })
  report.exceptionCount = register.exceptions.length
}

const stripComments = (text) => {
  let result = text
  let start = result.indexOf('<!--')
  while (start !== -1) {
    const end = result.indexOf('-->', start)
    result = end === -1 ? result.slice(0, start) : result.slice(0, start) + result.slice(end + '-->'.length)
    start = result.indexOf('<!--')
  }
  return result
}

/** Splits a plan into its YAML front matter and its level-two sections. */
const parsePlan = (text) => {
  const [, frontMatter, body] = text.split(/^---$/m)
  const sections = new Map()
  let heading
  for (const line of (body ?? text).split('\n')) {
    if (line.startsWith('## ')) {
      heading = line.slice('## '.length).trim()
      sections.set(heading, [])
    } else if (heading !== undefined) {
      sections.get(heading).push(line)
    }
  }
  const items = (name) => stripComments((sections.get(name) ?? []).join('\n'))
    .split('\n')
    .filter((line) => line.startsWith('- '))
  return { front: frontMatter === undefined ? undefined : parse(frontMatter), items, sections }
}

const checkPlanStatus = (plan, label, report) => {
  const status = plan.front.status
  const openQuestions = plan.items('Blocking questions')
  if (STARTED_STATUSES.has(status) && openQuestions.length > 0) {
    report.errors.push(`${label} is ${status} with ${String(openQuestions.length)} open blocking questions`)
  }
  if (status !== 'done') {
    return
  }
  const criteria = plan.items('Acceptance')
  const unsettled = criteria.filter((criterion) => !SETTLED_CRITERION.test(criterion))
  if (criteria.length === 0) {
    report.errors.push(`${label} is done but lists no acceptance criterion`)
  }
  for (const criterion of unsettled) {
    report.errors.push(`${label} is done with an unsettled criterion: ${criterion.slice('- '.length)}`)
  }
}

const checkPlan = (path, projectDirectory, report) => {
  const label = relative(projectDirectory, path)
  const plan = parsePlan(readFileSync(path, 'utf8'))
  if (plan.front === undefined || plan.front === null) {
    report.errors.push(`${label} has no front matter`)
    return
  }
  if (!PLAN_STATUSES.has(plan.front.status)) {
    report.errors.push(`${label}: status must be draft, ready, in-progress or done`)
  }
  if (plan.front.workflow !== undefined && !WORKFLOWS.has(plan.front.workflow)) {
    report.errors.push(`${label}: workflow must be assisted or autonomous`)
  }
  for (const field of ['issue', 'risk-reassessment']) {
    if (!isFilled(plan.front[field])) {
      report.errors.push(`${label}: ${field} is required`)
    }
  }
  const missing = PLAN_SECTIONS.filter((section) => !plan.sections.has(section))
  if (missing.length > 0) {
    report.errors.push(`${label} is missing the sections ${missing.join(', ')}`)
  }
  checkPlanStatus(plan, label, report)
}

const checkPlans = (projectDirectory, report) => {
  const featuresPath = resolve(projectDirectory, FEATURES_DIRECTORY)
  if (!existsSync(featuresPath)) {
    return
  }
  const plans = readdirSync(featuresPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => resolve(featuresPath, entry.name, 'plan.md'))
    .filter((path) => existsSync(path))
  for (const path of plans) {
    checkPlan(path, projectDirectory, report)
  }
  report.planCount = plans.length
}

/**
 * Validates the project record and the exception register. `today` is
 * injectable so the expiry check is deterministic under test.
 */
export const checkFoundation = ({ projectDirectory, today = new Date() }) => {
  const report = { errors: [], warnings: [], exceptionCount: 0, planCount: 0 }
  checkManifest(projectDirectory, report)
  checkExceptions(projectDirectory, toIsoDate(today), report)
  checkPlans(projectDirectory, report)
  return report
}

const invokedDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (invokedDirectly) {
  const report = checkFoundation({ projectDirectory: process.cwd() })
  for (const warning of report.warnings) {
    process.stderr.write(`warning: ${warning}\n`)
  }
  for (const error of report.errors) {
    process.stderr.write(`error: ${error}\n`)
  }
  if (report.errors.length > 0) {
    process.exitCode = 1
  } else {
    process.stdout.write(
      `foundation record: ok (${String(report.exceptionCount)} exceptions, `
      + `${String(report.planCount)} plans)\n`,
    )
  }
}

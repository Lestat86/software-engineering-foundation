#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
  for (const threshold of ['diffCoverage', 'mutationScore']) {
    if (!isPercentage(premerge[threshold])) {
      report.errors.push(`${MANIFEST_FILE}: premerge.${threshold} must be a percentage`)
    }
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

/**
 * Validates the project record and the exception register. `today` is
 * injectable so the expiry check is deterministic under test.
 */
export const checkFoundation = ({ projectDirectory, today = new Date() }) => {
  const report = { errors: [], warnings: [], exceptionCount: 0 }
  checkManifest(projectDirectory, report)
  checkExceptions(projectDirectory, toIsoDate(today), report)
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
    process.stdout.write(`foundation record: ok (${String(report.exceptionCount)} exceptions)\n`)
  }
}

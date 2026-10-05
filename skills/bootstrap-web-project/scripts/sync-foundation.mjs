#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

import {
  ASSET_RECORD_PATH,
  describeKnipIgnores,
  formatAssetRecord,
  hashContent,
  readVersions,
  renderFoundationAssets,
} from './generate-project.mjs'
import { CLI_ARGUMENTS_OFFSET } from './generate-project.constants.mjs'

const assetsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../assets')
const MANIFEST_FILE = '.engineering-foundation.yml'
const CONFLICT_SUFFIX = '.sef-new'

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

/**
 * Reads the fields synchronization needs from the project record. The record
 * is written by the generator with JSON-compatible values, so each field is
 * read from its line rather than with a YAML dependency the skill does not
 * have.
 */
const readRecord = (projectDirectory) => {
  const recordPath = resolve(projectDirectory, MANIFEST_FILE)
  if (!existsSync(recordPath)) {
    throw new Error(`${MANIFEST_FILE} not found: synchronize only a project the foundation generated or adopted`)
  }
  const record = readFileSync(recordPath, 'utf8')
  const field = (name) => {
    const match = new RegExp(`^${name}: (.+)$`, 'm').exec(record)
    if (match === null) {
      throw new Error(`${MANIFEST_FILE} has no ${name} field`)
    }
    return JSON.parse(match[1])
  }
  const level = /^ {2}level: "(R[123])"$/m.exec(record)
  return {
    ci: field('ci'),
    securityLevel: level === null ? 'R2' : level[1],
    foundationVersion: field('foundationVersion'),
    profiles: field('profiles'),
    workspaces: field('workspaces'),
  }
}

const rootProfiles = ({ profiles, workspaces }) => {
  const workspaceProfiles = new Set(Object.values(workspaces))
  return profiles.filter((profileName) => !workspaceProfiles.has(profileName))
}

const expectedDependencies = ({ profiles }, versions) => {
  return Object.assign({}, ...profiles.flatMap((profileName) => {
    const profile = versions.profiles[profileName]
    return [...profile.dependencies, ...profile.devDependencies].map((group) => versions[group])
  }))
}

const expectedScripts = (record, versions) => {
  return Object.assign({}, ...rootProfiles(record).map((profileName) => {
    const templatePath = resolve(assetsRoot, versions.profiles[profileName].template, 'package.json')
    return existsSync(templatePath) ? readJson(templatePath).scripts : {}
  }))
}

/** Compares declared dependencies and root scripts with the current foundation. */
const describeManifestChanges = ({ projectDirectory, record, versions }) => {
  const declared = Object.assign({}, ...['.', ...Object.keys(record.workspaces)].map((directory) => {
    const manifest = readJson(resolve(projectDirectory, directory, 'package.json'))
    return { ...manifest.dependencies, ...manifest.devDependencies }
  }))
  const scripts = readJson(resolve(projectDirectory, 'package.json')).scripts ?? {}

  return [
    ...Object.entries(expectedDependencies(record, versions))
      .filter(([name, version]) => declared[name] !== version)
      .map(([name, version]) => `dependency ${name}: ${declared[name] ?? 'missing'} → ${version}`),
    ...Object.entries(expectedScripts(record, versions))
      .filter(([name, command]) => scripts[name] !== command)
      .map(([name, command]) => `script ${name}: ${scripts[name] ?? 'missing'} → ${command}`),
  ]
}

const ALIGNED_ACTIONS = new Set(['add', 'current', 'update'])

const classifyAsset = ({ current, expectedHash, recordedHash }) => {
  if (current === undefined) {
    return recordedHash === undefined ? 'add' : 'missing'
  }
  const currentHash = hashContent(current)
  if (currentHash === expectedHash) {
    return 'current'
  }
  return currentHash === recordedHash ? 'update' : 'conflict'
}

/**
 * Classifies one owned file, records the hash it ends with and, with `apply`,
 * writes the new version in place or next to a file the project changed.
 */
const syncAsset = ({ apply, asset, hashes, path, projectDirectory, recordedHashes }) => {
  const targetPath = resolve(projectDirectory, path)
  const current = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : undefined
  const expectedHash = hashContent(asset.content)
  const action = classifyAsset({ current, expectedHash, recordedHash: recordedHashes[path] })

  if (ALIGNED_ACTIONS.has(action)) {
    hashes[path] = expectedHash
  } else if (recordedHashes[path] !== undefined) {
    hashes[path] = recordedHashes[path]
  }
  if (apply && (action === 'add' || action === 'update')) {
    mkdirSync(dirname(targetPath), { recursive: true })
    writeFileSync(targetPath, asset.content)
    chmodSync(targetPath, asset.mode)
  }
  if (apply && action === 'conflict') {
    writeFileSync(`${targetPath}${CONFLICT_SUFFIX}`, asset.content)
  }
  return action
}

const writeRecords = ({ aligned, hashes, projectDirectory, record, recordPath, versions }) => {
  const version = aligned ? versions.foundationVersion : record.foundationVersion
  writeFileSync(recordPath, formatAssetRecord(version, hashes))
  if (aligned) {
    const manifestPath = resolve(projectDirectory, MANIFEST_FILE)
    writeFileSync(
      manifestPath,
      readFileSync(manifestPath, 'utf8').replace(
        /^foundationVersion: ".*"$/m,
        `foundationVersion: "${versions.foundationVersion}"`,
      ),
    )
  }
}

/**
 * Compares the foundation-owned files of a project with what the current
 * foundation renders and, with `apply`, brings them in line:
 *
 * - `current`: already equal; `update`: untouched since the last copy, so it is
 *   replaced; `add`: new in this foundation version, so it is written;
 * - `conflict`: changed in the project, so it is left alone and the new version
 *   is written next to it as `<file>.sef-new`;
 * - `missing`: deleted in the project, so it is reported and not recreated;
 * - `obsolete`: no longer part of the foundation, so it is reported for manual
 *   removal. Nothing is ever deleted.
 *
 * The record version moves to the foundation version only when every asset,
 * dependency and script is aligned.
 */
export const syncFoundation = ({ projectDirectory, apply = false }) => {
  const versions = readVersions()
  const record = readRecord(projectDirectory)
  const projectName = readJson(resolve(projectDirectory, 'package.json')).name
  const values = {
    KNIP_PROFILE_IGNORES: describeKnipIgnores(record.profiles, projectName),
    NODE_MAJOR: String(versions.runtime.nodeMajor),
    SCOPE: projectName,
  }
  const assets = renderFoundationAssets({
    appliedProfiles: record.profiles,
    ci: record.ci,
    securityLevel: record.securityLevel,
    values,
    versions,
  })
  const recordPath = resolve(projectDirectory, ASSET_RECORD_PATH)
  const recordedHashes = existsSync(recordPath) ? readJson(recordPath).files : {}
  const hashes = {}
  const actions = [...assets].map(([path, asset]) => {
    const action = syncAsset({ apply, asset, hashes, path, projectDirectory, recordedHashes })
    return { path, action }
  })
  for (const path of Object.keys(recordedHashes).filter((recorded) => !assets.has(recorded))) {
    actions.push({ path, action: 'obsolete' })
  }

  const manifestChanges = describeManifestChanges({ projectDirectory, record, versions })
  const aligned = actions.every(({ action }) => ALIGNED_ACTIONS.has(action))
    && manifestChanges.length === 0

  if (apply) {
    writeRecords({ aligned, hashes, projectDirectory, record, recordPath, versions })
  }

  return {
    actions,
    aligned,
    foundationVersion: versions.foundationVersion,
    manifestChanges,
    projectVersion: record.foundationVersion,
  }
}

const usage = `usage: sync-foundation.mjs --target <dir> [--apply]

Compares the foundation-owned files of a generated project with this version
of the foundation. Without --apply it only reports; with --apply it updates
untouched files, adds new ones and writes <file>${CONFLICT_SUFFIX} next to files the
project changed. It never deletes or overwrites a changed file.`

const runCli = (argv) => {
  const { values } = parseArgs({
    args: argv,
    options: {
      target: { type: 'string' },
      apply: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  })
  if (values.help) {
    process.stdout.write(`${usage}\n`)
    return
  }
  if (values.target === undefined) {
    throw new Error(`--target is required\n${usage}`)
  }

  const report = syncFoundation({ projectDirectory: resolve(values.target), apply: values.apply })
  const lines = report.actions
    .filter(({ action }) => action !== 'current')
    .map(({ path, action }) => `${action.padEnd('obsolete'.length)}  ${path}`)
  const verb = values.apply ? 'now states' : 'can state'
  const outcome = report.aligned
    ? `aligned: the record ${verb} ${report.foundationVersion}`
    : 'not aligned yet: resolve the conflicts and manual changes, then run again'
  process.stdout.write([
    `foundation ${report.projectVersion} → ${report.foundationVersion}`,
    ...(lines.length === 0 ? ['every foundation file is current'] : lines),
    ...report.manifestChanges.map((change) => `manual    ${change}`),
    outcome,
    values.apply ? '' : 'dry run: nothing was written; add --apply to write',
  ].filter((line) => line !== '').join('\n') + '\n')
}

const invokedDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (invokedDirectly) {
  try {
    runCli(process.argv.slice(CLI_ARGUMENTS_OFFSET))
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}

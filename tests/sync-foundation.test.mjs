import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  ASSET_RECORD_PATH,
  generateProject,
  hashContent,
  readVersions,
} from '../skills/bootstrap-web-project/scripts/generate-project.mjs'
import { syncFoundation } from '../skills/bootstrap-web-project/scripts/sync-foundation.mjs'
import { clearGeneratedDirectory } from './helpers/generated-directory.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const syncScript = resolve(repositoryRoot, 'skills/bootstrap-web-project/scripts/sync-foundation.mjs')
const { foundationVersion } = readVersions()

const freshProject = () => {
  const projectDirectory = clearGeneratedDirectory('sync')
  generateProject({
    targetDirectory: projectDirectory,
    projectName: 'foundation-sync-fixture',
    profiles: ['fastify'],
  })
  return projectDirectory
}

const read = (projectDirectory, path) => readFileSync(resolve(projectDirectory, path), 'utf8')
const write = (projectDirectory, path, content) => {
  writeFileSync(resolve(projectDirectory, path), content)
}
const readRecord = (projectDirectory) => JSON.parse(read(projectDirectory, ASSET_RECORD_PATH))
const writeRecord = (projectDirectory, record) => {
  write(projectDirectory, ASSET_RECORD_PATH, `${JSON.stringify(record, null, 2)}\n`)
}
const actionOf = (report, path) => report.actions.find((entry) => entry.path === path)?.action

test('a generated project records one hash per foundation file and is already current', () => {
  const projectDirectory = freshProject()
  const record = readRecord(projectDirectory)

  assert.equal(record.foundationVersion, foundationVersion)
  assert.equal(record.files['.config/eslint/base.mjs'], hashContent(read(projectDirectory, '.config/eslint/base.mjs')))
  assert.equal(record.files['src/app.ts'], undefined, 'application code belongs to the project')

  const report = syncFoundation({ projectDirectory })
  assert.ok(report.actions.every(({ action }) => action === 'current'))
  assert.deepEqual(report.manifestChanges, [])
  assert.equal(report.aligned, true)
})

test('an untouched outdated file is updated and a changed one gets a side-by-side copy', () => {
  const projectDirectory = freshProject()
  const basePath = '.config/eslint/base.mjs'
  const knipPath = 'knip.config.js'
  const current = { base: read(projectDirectory, basePath), knip: read(projectDirectory, knipPath) }
  const record = readRecord(projectDirectory)

  // An older foundation wrote this content, recorded it, and nobody touched it.
  const outdated = `${current.base}// from an older foundation\n`
  write(projectDirectory, basePath, outdated)
  record.files[basePath] = hashContent(outdated)
  // The project edited a file the record still describes as generated.
  write(projectDirectory, knipPath, `${current.knip}// project change\n`)
  writeRecord(projectDirectory, record)

  const dryRun = syncFoundation({ projectDirectory })
  assert.equal(actionOf(dryRun, basePath), 'update')
  assert.equal(actionOf(dryRun, knipPath), 'conflict')
  assert.equal(dryRun.aligned, false)
  assert.equal(read(projectDirectory, basePath), outdated, 'a dry run writes nothing')

  syncFoundation({ projectDirectory, apply: true })
  assert.equal(read(projectDirectory, basePath), current.base)
  assert.equal(read(projectDirectory, knipPath), `${current.knip}// project change\n`)
  assert.equal(read(projectDirectory, `${knipPath}.sef-new`), current.knip)
  assert.equal(readRecord(projectDirectory).files[basePath], hashContent(current.base))
})

test('new files are added, deleted ones are reported, retired ones are never removed', () => {
  const projectDirectory = freshProject()
  const record = readRecord(projectDirectory)
  delete record.files['.secretlintrc.json']
  rmSync(resolve(projectDirectory, '.secretlintrc.json'))
  rmSync(resolve(projectDirectory, '.dependency-cruiser.mjs'))
  record.files['.config/foundation/retired.mjs'] = hashContent('retired')
  write(projectDirectory, '.config/foundation/retired.mjs', 'retired')
  writeRecord(projectDirectory, record)

  const report = syncFoundation({ projectDirectory, apply: true })
  assert.equal(actionOf(report, '.secretlintrc.json'), 'add')
  assert.equal(actionOf(report, '.dependency-cruiser.mjs'), 'missing')
  assert.equal(actionOf(report, '.config/foundation/retired.mjs'), 'obsolete')
  assert.ok(existsSync(resolve(projectDirectory, '.secretlintrc.json')))
  assert.equal(existsSync(resolve(projectDirectory, '.dependency-cruiser.mjs')), false)
  assert.ok(existsSync(resolve(projectDirectory, '.config/foundation/retired.mjs')))
})

test('the recorded version moves only when files, dependencies and scripts are aligned', () => {
  const projectDirectory = freshProject()
  const manifest = read(projectDirectory, '.engineering-foundation.yml')
  write(projectDirectory, '.engineering-foundation.yml', manifest.replace(
    /^foundationVersion: ".*"$/m,
    'foundationVersion: "1.0.0"',
  ))
  const packageJson = JSON.parse(read(projectDirectory, 'package.json'))
  const { knip, ...withoutKnip } = packageJson.devDependencies
  write(projectDirectory, 'package.json', JSON.stringify({
    ...packageJson,
    devDependencies: withoutKnip,
    scripts: { ...packageJson.scripts, 'lint:deps': 'true' },
  }))

  const pending = syncFoundation({ projectDirectory, apply: true })
  assert.deepEqual(pending.manifestChanges, [
    `dependency knip: missing → ${knip}`,
    `script lint:deps: true → ${packageJson.scripts['lint:deps']}`,
  ])
  assert.equal(pending.aligned, false)
  assert.match(read(projectDirectory, '.engineering-foundation.yml'), /^foundationVersion: "1\.0\.0"$/m)

  write(projectDirectory, 'package.json', JSON.stringify(packageJson))
  const aligned = syncFoundation({ projectDirectory, apply: true })
  assert.equal(aligned.aligned, true)
  assert.match(
    read(projectDirectory, '.engineering-foundation.yml'),
    new RegExp(`^foundationVersion: "${foundationVersion.replaceAll('.', '\\.')}"$`, 'm'),
  )
})

test('a project without a hash record is adopted file by file', () => {
  const projectDirectory = freshProject()
  rmSync(resolve(projectDirectory, ASSET_RECORD_PATH))
  write(projectDirectory, 'lint-staged.config.mjs', 'export default {}\n')

  const report = syncFoundation({ projectDirectory, apply: true })
  assert.equal(actionOf(report, '.config/eslint/base.mjs'), 'current')
  assert.equal(actionOf(report, 'lint-staged.config.mjs'), 'conflict')
  assert.equal(readRecord(projectDirectory).files['lint-staged.config.mjs'], undefined)
  assert.ok(existsSync(resolve(projectDirectory, 'lint-staged.config.mjs.sef-new')))
})

test('the command line reports a dry run and refuses a directory without a record', () => {
  const projectDirectory = freshProject()
  const dryRun = spawnSync(process.execPath, [syncScript, '--target', projectDirectory], {
    encoding: 'utf8',
  })
  assert.equal(dryRun.status, 0, dryRun.stderr)
  assert.match(dryRun.stdout, /^every foundation file is current$/m)
  assert.match(dryRun.stdout, /^dry run: nothing was written; add --apply to write$/m)

  rmSync(resolve(projectDirectory, '.engineering-foundation.yml'))
  const refused = spawnSync(process.execPath, [syncScript, '--target', projectDirectory], {
    encoding: 'utf8',
  })
  assert.equal(refused.status, 1)
  assert.match(refused.stderr, /\.engineering-foundation\.yml not found/)
})

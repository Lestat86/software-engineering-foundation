import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test, { afterEach, before } from 'node:test'

import { checkFoundation } from '../skills/bootstrap-web-project/assets/tooling/foundation/check-foundation.mjs'
import { generateProject } from '../skills/bootstrap-web-project/scripts/generate-project.mjs'
import { clearGeneratedDirectory, generatedDirectory } from './helpers/generated-directory.mjs'

const projectDirectory = generatedDirectory('foundation-record')
const editableFiles = ['.engineering-foundation.yml', 'docs/exceptions.yml', 'package.json']
const originals = new Map()

const write = (file, content) => writeFileSync(resolve(projectDirectory, file), content)
const read = (file) => readFileSync(resolve(projectDirectory, file), 'utf8')
const check = (today = new Date('2026-10-05')) => checkFoundation({ projectDirectory, today })

const exceptionEntry = (fields) => {
  const entry = {
    id: 'CORE-COMPLEXITY-001',
    scope: 'src/protocol/state-table.ts',
    justification: 'The table mirrors the transitions of the protocol specification.',
    owner: 'platform team',
    expires: '2026-12-31',
    ...fields,
  }
  const lines = Object.entries(entry)
    .filter(([, value]) => value !== undefined)
    .map(([key, value], index) => `${index === 0 ? '  - ' : '    '}${key}: ${value}`)
  return `exceptions:\n${lines.join('\n')}\n`
}

before(() => {
  clearGeneratedDirectory('foundation-record')
  generateProject({
    targetDirectory: projectDirectory,
    projectName: 'foundation-record-fixture',
    profiles: ['fastify'],
  })
  for (const file of editableFiles) {
    originals.set(file, read(file))
  }
})

afterEach(() => {
  for (const [file, content] of originals) {
    write(file, content)
  }
})

test('a generated project carries a valid record, an empty register and the requirement levels', () => {
  assert.match(read('.engineering-foundation.yml'), /^workflow: "assisted"$/m)
  const requirements = JSON.parse(read('.config/foundation/requirements.json'))
  assert.equal(requirements['CORE-DEBT-001'], 'MUST')
  assert.equal(requirements['CORE-CLARITY-001'], 'SHOULD')

  assert.deepEqual(check(), { errors: [], warnings: [], exceptionCount: 0, planCount: 0 })

  const cli = spawnSync(process.execPath, ['.config/foundation/check-foundation.mjs'], {
    cwd: projectDirectory,
    encoding: 'utf8',
  })
  assert.equal(cli.status, 0, cli.stderr)
  assert.match(cli.stdout, /^foundation record: ok \(0 exceptions, 0 plans\)$/m)

  const scripts = JSON.parse(read('package.json')).scripts
  assert.equal(
    scripts.lint,
    'yarn lint:foundation && yarn lint:code && yarn lint:deps && yarn lint:secrets',
  )
  assert.equal(scripts['lint:foundation'], 'node .config/foundation/check-foundation.mjs')
})

test('an exception is valid until its expiry date and fails the gate afterwards', () => {
  write('docs/exceptions.yml', exceptionEntry({}))
  assert.deepEqual(
    check(new Date('2026-12-31')),
    { errors: [], warnings: [], exceptionCount: 1, planCount: 0 },
  )

  const { errors } = check(new Date('2027-01-01'))
  assert.equal(errors.length, 1)
  assert.match(errors[0], /CORE-COMPLEXITY-001\) expired on 2026-12-31/)
})

test('an exception needs every field, a known requirement and a calendar date', () => {
  const cases = [
    [{ owner: undefined }, /is missing owner/],
    [{ id: 'CORE-UNKNOWN-001' }, /references unknown requirement CORE-UNKNOWN-001/],
    [{ expires: '2027-02-30' }, /has an invalid expires date 2027-02-30/],
  ]

  for (const [fields, expected] of cases) {
    write('docs/exceptions.yml', exceptionEntry(fields))
    const { errors } = check()
    assert.equal(errors.length, 1, `expected one error for ${JSON.stringify(fields)}`)
    assert.match(errors[0], expected)
  }

  write('docs/exceptions.yml', 'exceptions: none\n')
  assert.match(check().errors[0], /exceptions must be a list/)
})

test('the manifest must record a known workflow, a rationale and the real package manager', () => {
  const manifest = originals.get('.engineering-foundation.yml')
  write(
    '.engineering-foundation.yml',
    manifest
      .replace('workflow: "assisted"', 'workflow: "unattended"')
      .replace(/rationale: ".*"/, 'rationale: ""')
      .replace(/packageManager: ".*"/, 'packageManager: "yarn@1.22.22"'),
  )
  const { errors } = check()

  assert.ok(errors.some((error) => /workflow must be assisted or autonomous/.test(error)))
  assert.ok(errors.some((error) => /security\.rationale must explain/.test(error)))
  assert.ok(errors.some((error) => /packageManager yarn@1\.22\.22 does not match/.test(error)))
})

test('an R1 project installing authentication is warned to reassess its level', () => {
  const manifest = JSON.parse(originals.get('package.json'))
  write(
    'package.json',
    JSON.stringify({ ...manifest, dependencies: { ...manifest.dependencies, 'better-auth': '1.0.0' } }),
  )
  const { errors, warnings } = check()

  assert.deepEqual(errors, [])
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /R1 excludes authentication and payments, but better-auth/)
})

test('the generator records the selected workflow and rejects an unknown one', () => {
  const autonomousDirectory = clearGeneratedDirectory('foundation-record-autonomous')
  generateProject({
    targetDirectory: autonomousDirectory,
    projectName: 'foundation-record-autonomous',
    profiles: ['fastify'],
    workflow: 'autonomous',
  })
  assert.match(
    readFileSync(resolve(autonomousDirectory, '.engineering-foundation.yml'), 'utf8'),
    /^workflow: "autonomous"$/m,
  )

  assert.throws(
    () => generateProject({
      targetDirectory: clearGeneratedDirectory('foundation-record-invalid'),
      projectName: 'foundation-record-invalid',
      profiles: ['fastify'],
      workflow: 'unattended',
    }),
    /workflow must be assisted or autonomous/,
  )
})

test('a generated project carries the requirements, their index and the feature templates', () => {
  for (const file of [
    'docs/foundation/README.md',
    'docs/foundation/standards/core.md',
    'docs/foundation/security/r1-basic.md',
    'docs/features/README.md',
    'docs/features/_template/plan.md',
    'docs/features/_template/spec.md',
  ]) {
    assert.ok(read(file).length > 0, file)
  }
  const index = read('docs/foundation/README.md')
  assert.match(index, /^## Applicable to this project \(R1, fastify\)$/m)
  assert.match(index.split('## Present for reference only')[0], /\[security\/r1-basic\.md\]/)
  assert.match(index.split('## Present for reference only')[1], /\[stacks\/nest\.md\]/)
})

test('a plan is checked against its status: questions before work, criteria before done', (context) => {
  const planPath = 'docs/features/search/plan.md'
  mkdirSync(resolve(projectDirectory, 'docs/features/search'), { recursive: true })
  context.after(() => rmSync(resolve(projectDirectory, 'docs/features/search'), { recursive: true }))
  const template = read('docs/features/_template/plan.md')
  const withStatus = (status, extra = {}) => {
    let plan = template.replace(/^status: draft$/m, `status: ${status}`)
    for (const [section, items] of Object.entries(extra)) {
      plan = plan.replace(`## ${section}\n`, `## ${section}\n\n${items}\n`)
    }
    return plan
  }

  write(planPath, withStatus('draft'))
  assert.deepEqual(check().errors, [], 'the template is a valid draft')
  assert.equal(check().planCount, 1)

  write(planPath, withStatus('ready', { 'Blocking questions': '- Which tracker owns refunds?' }))
  assert.deepEqual(check().errors, [`${planPath} is ready with 1 open blocking questions`])

  write(planPath, withStatus('done'))
  assert.match(check().errors[0], /is done with an unsettled criterion: \[ \] <criterion> — auto: <test name>$/)

  const settled = [
    '- [x] Results are paged — auto: search.test.ts',
    '- [ ] Screen reader announces results — manual: QA team',
    '- [ ] Saved searches — deferred: #42',
  ].join('\n')
  write(planPath, withStatus('done').replace(/^- \[ \] <criterion> — auto: <test name>$/m, settled))
  assert.deepEqual(check().errors, [])

  write(planPath, withStatus('draft').replace('## Out of scope\n', '').replace(/^status: draft$/m, 'status: started'))
  assert.deepEqual(check().errors, [
    `${planPath}: status must be draft, ready, in-progress or done`,
    `${planPath} is missing the sections Out of scope`,
  ])

  write(planPath, '# Plan without front matter\n')
  assert.deepEqual(check().errors, [`${planPath} has no front matter`])
})

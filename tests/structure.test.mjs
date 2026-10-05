import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { ESLint, Linter } from 'eslint'

import { foundationPlugin } from '../skills/bootstrap-web-project/assets/tooling/eslint/base.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const skillPath = resolve(
  repositoryRoot,
  'skills/bootstrap-web-project/SKILL.md',
)
const referencesPath = resolve(
  repositoryRoot,
  'skills/bootstrap-web-project/references',
)

const collectMarkdownFiles = (directory) => {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      return collectMarkdownFiles(entryPath)
    }
    return entry.isFile() && entry.name.endsWith('.md') ? [entryPath] : []
  })
}

const collectRequirementIds = () => {
  return collectMarkdownFiles(referencesPath).flatMap((file) => {
    const document = readFileSync(file, 'utf8')
    return [...document.matchAll(/^## `([A-Z][A-Z0-9-]+)`[^\n]*$/gm)].map(
      (match) => match[1],
    )
  })
}

test('the bootstrap skill passes the portable skill-creator metadata contract', () => {
  const skill = readFileSync(skillPath, 'utf8')
  const frontmatterMatch = skill.match(/^---\n([\s\S]*?)\n---/)

  assert.ok(frontmatterMatch, 'missing or malformed YAML frontmatter')
  const frontmatter = new Map(
    frontmatterMatch[1]
      .split('\n')
      .filter((line) => line.trim() !== '' && !/^\s/.test(line))
      .map((line) => {
        const property = line.match(/^([a-z][a-z-]*):(?: +(\S.*))?$/)
        assert.ok(property, `invalid top-level frontmatter line: ${line}`)
        return [property[1], property[2] ?? '']
      }),
  )
  const allowedProperties = new Set([
    'name',
    'description',
    'license',
    'allowed-tools',
    'metadata',
  ])

  for (const property of frontmatter.keys()) {
    assert.ok(allowedProperties.has(property), `unexpected property: ${property}`)
  }

  assert.ok(frontmatter.has('name'), 'missing name')
  assert.ok(frontmatter.has('description'), 'missing description')

  const name = frontmatter.get('name')
  const description = frontmatter.get('description')

  assert.equal(name, 'bootstrap-web-project')
  assert.match(name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  assert.ok(name.length <= 64, 'skill name exceeds 64 characters')
  assert.ok(description.length <= 1024, 'description exceeds 1024 characters')
  assert.doesNotMatch(description, /[<>]/)
  assert.doesNotMatch(description, /^\[TODO:/)

  const bodyWithoutFencedCode = skill
    .slice(frontmatterMatch[0].length)
    .replace(/(```|~~~)[\s\S]*?\1/g, '')
  assert.doesNotMatch(bodyWithoutFencedCode, /^ {0,3}\[TODO:[^\n]*\]\s*$/m)
  assert.match(skill, /Next\.js is outside scope/)
})

test('every relative Markdown link in the skill and its references resolves', () => {
  const pending = [skillPath]
  const visited = new Set()

  while (pending.length > 0) {
    const documentPath = pending.pop()
    if (visited.has(documentPath)) {
      continue
    }
    visited.add(documentPath)

    const document = readFileSync(documentPath, 'utf8')
    // eslint-disable-next-line sonarjs/super-linear-regex -- trusted repository Markdown
    const links = [...document.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
      .map((match) => match[1])
      .filter((target) => !target.includes('://'))

    for (const link of links) {
      const targetPath = resolve(dirname(documentPath), link)
      assert.ok(existsSync(targetPath), `missing routed reference: ${link}`)

      if (targetPath.endsWith('.md')) {
        pending.push(targetPath)
      }
    }
  }

  assert.ok(visited.size > 1, 'expected the skill to route to references')
})

test('the common generated-project contract is present', () => {
  const requiredAssets = [
    'skills/bootstrap-web-project/assets/common/AGENTS.md',
    'skills/bootstrap-web-project/assets/common/.engineering-foundation.yml',
    'skills/bootstrap-web-project/assets/common/.editorconfig',
    'skills/bootstrap-web-project/assets/common/.node-version',
    'skills/bootstrap-web-project/assets/common/.yarnrc.yml',
  ]

  for (const asset of requiredAssets) {
    assert.ok(existsSync(resolve(repositoryRoot, asset)), `missing asset: ${asset}`)
  }
})

test('shared tooling assets are complete and never introduce Prettier or npx', () => {
  const toolingPath = resolve(
    repositoryRoot,
    'skills/bootstrap-web-project/assets/tooling',
  )
  const requiredAssets = [
    'versions.json',
    'eslint/base.mjs',
    'eslint/node.mjs',
    'eslint/react.mjs',
    'eslint/stylistic.mjs',
    'eslint/typescript.mjs',
    'typescript/tsconfig.base.json',
    'typescript/tsconfig.browser.json',
    'typescript/tsconfig.node.json',
    'git/commitlint.config.mjs',
    'git/lint-staged.config.mjs',
    'git/.husky/pre-commit',
    'git/.husky/commit-msg',
  ]

  for (const asset of requiredAssets) {
    assert.ok(existsSync(resolve(toolingPath, asset)), `missing asset: ${asset}`)
  }

  const assetContents = requiredAssets
    .map((asset) => readFileSync(resolve(toolingPath, asset), 'utf8'))
    .join('\n')
  assert.doesNotMatch(assetContents, /\bprettier\b/i)
  assert.doesNotMatch(assetContents, /\bnpx\b/)

  const preCommit = readFileSync(
    resolve(toolingPath, 'git/.husky/pre-commit'),
    'utf8',
  ).trim()
  assert.equal(preCommit, 'corepack yarn lint-staged')
  assert.ok(statSync(resolve(toolingPath, 'git/.husky/pre-commit')).mode & 0o100)
  assert.ok(statSync(resolve(toolingPath, 'git/.husky/commit-msg')).mode & 0o100)
})

test('the dependency matrix stays exact and on verified compatibility majors', () => {
  const versions = JSON.parse(
    readFileSync(
      resolve(
        repositoryRoot,
        'skills/bootstrap-web-project/assets/tooling/versions.json',
      ),
      'utf8',
    ),
  )
  const groupNames = Object.keys(versions).filter((key) => key.endsWith('Dependencies'))
  const dependencies = {}

  for (const groupName of groupNames) {
    for (const [name, version] of Object.entries(versions[groupName])) {
      assert.ok(
        !(name in dependencies) || dependencies[name] === version,
        `${name} is pinned to different versions across groups`,
      )
      dependencies[name] = version
    }
  }

  for (const [profileName, profile] of Object.entries(versions.profiles)) {
    assert.ok(
      existsSync(resolve(repositoryRoot, 'skills/bootstrap-web-project/assets', profile.template)),
      `${profileName} points to a missing template`,
    )
    for (const groupName of [...profile.dependencies, ...profile.devDependencies]) {
      assert.ok(groupName in versions, `${profileName} references unknown group ${groupName}`)
    }
    for (const groupName of profile.resolutions ?? []) {
      assert.ok(groupName in versions, `${profileName} references unknown resolution group ${groupName}`)
    }
    for (const moduleName of profile.eslintModules) {
      assert.ok(
        existsSync(
          resolve(repositoryRoot, 'skills/bootstrap-web-project/assets/tooling/eslint', `${moduleName}.mjs`),
        ),
        `${profileName} references unknown ESLint module ${moduleName}`,
      )
    }
  }

  assert.equal(
    versions.foundationVersion,
    JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8')).version,
    'versions.json carries the foundation version so installed skills stay self-contained',
  )
  assert.equal(versions.runtime.nodeMajor, 24)
  assert.equal(versions.runtime.yarn, '4.18.0')
  assert.match(dependencies.eslint, /^9\./)
  assert.match(dependencies.typescript, /^5\.9\./)
  assert.match(dependencies['typescript-eslint'], /^8\./)
  assert.match(dependencies.vite, /^8\./)
  assert.match(dependencies.vitest, /^5\./)
  assert.match(dependencies.react, /^19\./)
  assert.equal(dependencies.react, dependencies['react-dom'])
  assert.equal('prettier' in dependencies, false)

  for (const [name, version] of Object.entries(dependencies)) {
    assert.match(version, /^\d+\.\d+\.\d+$/, `${name} must use an exact version`)
  }

  const repositoryPackage = JSON.parse(
    readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
  )
  assert.deepEqual(repositoryPackage.devDependencies, dependencies)
  assert.deepEqual(repositoryPackage.resolutions, versions.nestResolutions)
})

test('the representative ESLint composition enables typed and accessibility rules', async () => {
  const fixturePath = resolve(repositoryRoot, 'tests/fixtures/tooling')
  const eslint = new ESLint({
    cwd: fixturePath,
    overrideConfigFile: resolve(fixturePath, 'eslint.config.mjs'),
  })
  const reactConfig = await eslint.calculateConfigForFile(
    resolve(fixturePath, 'src/valid.tsx'),
  )
  const invalidResults = await eslint.lintFiles([
    resolve(fixturePath, 'src/invalid.ts'),
  ])
  const invalidConstantsResults = await eslint.lintFiles([
    resolve(fixturePath, 'src/invalid.constants.ts'),
  ])
  const validResults = await eslint.lintFiles([
    resolve(fixturePath, 'src/valid.ts'),
    resolve(fixturePath, 'src/valid.constants.ts'),
  ])
  const reportedRules = new Set(
    invalidResults[0].messages.map(({ ruleId }) => ruleId),
  )

  assert.equal(reactConfig.rules['jsx-a11y/alt-text'][0], 2)
  assert.equal(reactConfig.rules['react-hooks/rules-of-hooks'][0], 2)
  assert.equal(reactConfig.rules['@stylistic/semi'][0], 2)
  assert.ok(
    reportedRules.has('@typescript-eslint/no-explicit-any'),
    'expected typed linting to reject explicit any',
  )
  assert.ok(
    reportedRules.has('func-style'),
    'expected CORE-ARROW-001 to reject a function declaration',
  )
  assert.ok(
    reportedRules.has('no-restricted-syntax'),
    'expected CORE-ARROW-001 to reject a function expression bound to a variable',
  )
  assert.ok(
    reportedRules.has('@typescript-eslint/no-magic-numbers'),
    'expected CORE-CONSTANT-001 to reject an inline numeric literal',
  )
  assert.ok(
    invalidConstantsResults[0].messages.some(
      ({ ruleId }) => ruleId === '@typescript-eslint/naming-convention',
    ),
    'expected CORE-CONSTANT-001 to require UPPER_SNAKE_CASE in a constants module',
  )

  for (const result of validResults) {
    assert.equal(result.errorCount, 0, `unexpected error in ${result.filePath}`)
    assert.equal(result.warningCount, 0, `unexpected warning in ${result.filePath}`)
  }
})

test('the code health rules reject untracked debt, undescribed suppressions and complexity', async () => {
  const fixturePath = resolve(repositoryRoot, 'tests/fixtures/tooling')
  const eslint = new ESLint({
    cwd: fixturePath,
    overrideConfigFile: resolve(fixturePath, 'eslint.config.mjs'),
  })
  const [result] = await eslint.lintFiles([resolve(fixturePath, 'src/invalid-health.ts')])
  const reportedRules = result.messages.map(({ ruleId }) => ruleId)
  const expectations = [
    ['foundation/todo-issue-reference', 'CORE-DEBT-001 to reject a TODO and a FIXME without issue', 2],
    ['sonarjs/no-commented-code', 'CORE-DEBT-001 to reject commented-out code', 1],
    [
      '@eslint-community/eslint-comments/require-description',
      'CORE-SUPPRESS-001 to reject a directive without a reason',
      1,
    ],
    ['sonarjs/cognitive-complexity', 'CORE-COMPLEXITY-001 to bound cognitive complexity', 1],
    ['max-depth', 'CORE-COMPLEXITY-001 to bound nesting', 1],
  ]

  for (const [ruleId, expectation, count] of expectations) {
    assert.equal(
      reportedRules.filter((reported) => reported === ruleId).length,
      count,
      `expected ${expectation}`,
    )
  }
})

test('the debt marker rule accepts a project-specific issue reference', () => {
  const linter = new Linter({ configType: 'flat' })
  const config = [
    {
      plugins: { foundation: foundationPlugin },
      rules: { 'foundation/todo-issue-reference': ['error', { reference: '[A-Z]+-\\d+' }] },
    },
  ]
  const ruleIds = (code) => linter.verify(code, config).map(({ ruleId }) => ruleId)

  assert.deepEqual(ruleIds('// TODO(PROJ-42): tracked in the project tracker\n'), [])
  assert.deepEqual(ruleIds('// TODO(#42): wrong tracker for this project\n'), [
    'foundation/todo-issue-reference',
  ])
  assert.deepEqual(ruleIds('// a todo in prose is not a marker\n'), [])
})

test('numeric literals stay readable in tests and tool configuration', async () => {
  const fixturePath = resolve(repositoryRoot, 'tests/fixtures/tooling')
  const eslint = new ESLint({
    cwd: fixturePath,
    overrideConfigFile: resolve(fixturePath, 'eslint.config.mjs'),
  })

  for (const exemptFile of ['src/feature.test.ts', 'vitest.config.ts']) {
    const config = await eslint.calculateConfigForFile(
      resolve(fixturePath, exemptFile),
    )

    assert.equal(
      config.rules['@typescript-eslint/no-magic-numbers'][0],
      0,
      `expected ${exemptFile} to be exempt from the constants requirement`,
    )
    assert.equal(
      config.rules['func-style'][0],
      2,
      `expected ${exemptFile} to still require arrow functions`,
    )
  }
})

test('normative references have unique IDs and governance metadata', () => {
  const seenIds = new Map()
  let requirementCount = 0

  for (const referenceFile of collectMarkdownFiles(referencesPath)) {
    const document = readFileSync(referenceFile, 'utf8')
    const headings = [...document.matchAll(/^## `([A-Z][A-Z0-9-]+)`[^\n]*$/gm)]

    for (const [index, heading] of headings.entries()) {
      const id = heading[1]
      const start = heading.index
      const end = headings[index + 1]?.index ?? document.length
      const requirement = document.slice(start, end)

      assert.equal(
        seenIds.has(id),
        false,
        `duplicate requirement ID ${id} in ${referenceFile} and ${seenIds.get(id)}`,
      )
      seenIds.set(id, referenceFile)
      requirementCount += 1

      for (const field of [
        'Level',
        'Applies to',
        'Risk levels',
        'Requirement',
        'Rationale',
        'Verification',
        'Sources',
        'Exceptions',
      ]) {
        assert.match(
          requirement,
          new RegExp(`^- \\*\\*${field}:\\*\\*`, 'm'),
          `${id} is missing ${field}`,
        )
      }

      assert.match(
        requirement,
        /^- \*\*Level:\*\* (MUST|SHOULD|MAY)$/m,
        `${id} has an invalid normative level`,
      )
    }
  }

  assert.ok(requirementCount >= 20, 'expected a substantive shared baseline')
})

test('the WCAG map covers every WCAG 2.2 Level A and AA criterion', () => {
  const expectedCriteria = [
    '1.1.1',
    '1.2.1', '1.2.2', '1.2.3', '1.2.4', '1.2.5',
    '1.3.1', '1.3.2', '1.3.3', '1.3.4', '1.3.5',
    '1.4.1', '1.4.2', '1.4.3', '1.4.4', '1.4.5',
    '1.4.10', '1.4.11', '1.4.12', '1.4.13',
    '2.1.1', '2.1.2', '2.1.4',
    '2.2.1', '2.2.2',
    '2.3.1',
    '2.4.1', '2.4.2', '2.4.3', '2.4.4', '2.4.5', '2.4.6',
    '2.4.7', '2.4.11',
    '2.5.1', '2.5.2', '2.5.3', '2.5.4', '2.5.7', '2.5.8',
    '3.1.1', '3.1.2',
    '3.2.1', '3.2.2', '3.2.3', '3.2.4', '3.2.6',
    '3.3.1', '3.3.2', '3.3.3', '3.3.4', '3.3.7', '3.3.8',
    '4.1.2', '4.1.3',
  ]
  const mapPath = resolve(
    referencesPath,
    'accessibility/wcag-22-aa-map.md',
  )
  const map = readFileSync(mapPath, 'utf8')
  const rows = [...map.matchAll(/^\| (\d\.\d\.\d+) [^|]+\| (A|AA) \| ([^|]+) \|$/gm)]
  const mappedCriteria = rows.map((match) => match[1])

  assert.deepEqual(mappedCriteria, expectedCriteria)
  assert.equal(new Set(mappedCriteria).size, expectedCriteria.length)

  const requirementIds = new Set(collectRequirementIds())
  for (const row of rows) {
    const mappedIds = [...row[3].matchAll(/`([A-Z][A-Z0-9-]+)`/g)].map(
      (match) => match[1],
    )

    assert.ok(mappedIds.length > 0, `${row[1]} has no mapped local requirement`)
    for (const id of mappedIds) {
      assert.ok(requirementIds.has(id), `${row[1]} maps to unknown ${id}`)
    }
  }
})

test('security profiles compose the pinned cumulative ASVS baseline', () => {
  const securityPath = resolve(referencesPath, 'security')
  const asvs = readFileSync(resolve(securityPath, 'asvs.md'), 'utf8')
  const riskClassification = readFileSync(
    resolve(securityPath, 'risk-classification.md'),
    'utf8',
  )
  const manifest = readFileSync(
    resolve(
      repositoryRoot,
      'skills/bootstrap-web-project/assets/common/.engineering-foundation.yml',
    ),
    'utf8',
  )
  const expectedLevels = new Map([
    ['r1-basic.md', ['L1']],
    ['r2-standard.md', ['L1', 'L2']],
    ['r3-high.md', ['L1', 'L2', 'L3']],
  ])

  assert.match(asvs, /OWASP ASVS 5\.0\.0/)
  assert.doesNotMatch(asvs, /OWASP\/ASVS\/(?:tree|blob)\/master/)
  assert.match(riskClassification, /The highest applicable trigger wins/)
  assert.match(manifest, /^ {2}asvsVersion: "5\.0\.0"$/m)
  assert.match(manifest, /^ {2}rationale: /m)

  for (const [profileFile, levels] of expectedLevels) {
    const profile = readFileSync(resolve(securityPath, profileFile), 'utf8')

    assert.match(profile, /OWASP ASVS 5\.0\.0/)
    assert.match(profile, /\[shared baseline\]\(baseline\.md\)/)
    for (const level of levels) {
      assert.match(profile, new RegExp(`\\b${level}\\b`))
    }
  }
})

#!/usr/bin/env node

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

import {
  CLI_ARGUMENTS_OFFSET,
  MANIFEST_INDENT_SPACES,
  MAX_REPORTED_BLOCKING_ENTRIES,
} from './generate-project.constants.mjs'

const assetsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../assets')
const referencesRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../references')
const placeholderPattern = /\{\{([A-Z0-9_]+)\}\}/g
const appendableFiles = new Set(['.gitignore', '.env.example'])
const rootOnlyScripts = new Set([
  'lint',
  'lint:code',
  'lint:deps',
  'lint:fix',
  'lint:foundation',
  'lint:secrets',
  'premerge',
  'validate',
  'postinstall',
])
const workflows = new Set(['assisted', 'autonomous'])
const tolerableTargetEntries = new Set(['.git'])

export const readVersions = () => {
  return JSON.parse(readFileSync(resolve(assetsRoot, 'tooling/versions.json'), 'utf8'))
}

const collectMarkdownFiles = (directory) => {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      return collectMarkdownFiles(entryPath)
    }
    return entry.name.endsWith('.md') ? [entryPath] : []
  })
}

/**
 * Maps every requirement identifier of the references to its normative level,
 * so the generated project can reject an exception for an unknown requirement.
 */
export const readRequirementLevels = () => {
  const levels = {}
  for (const file of collectMarkdownFiles(referencesRoot)) {
    const document = readFileSync(file, 'utf8')
    for (const match of document.matchAll(/^## `([A-Z][A-Z0-9-]+)`[^\n]*\n\n- \*\*Level:\*\* (MUST|SHOULD|MAY)$/gm)) {
      levels[match[1]] = match[2]
    }
  }
  return Object.fromEntries(
    Object.entries(levels).sort(([left], [right]) => left.localeCompare(right)),
  )
}

/**
 * The generator never deletes anything. The target must not exist yet or must
 * be an empty directory; a freshly initialized Git repository is accepted.
 */
const ensureWritableTarget = (targetDirectory) => {
  if (!existsSync(targetDirectory)) {
    return
  }
  if (!statSync(targetDirectory).isDirectory()) {
    throw new Error(`target is not a directory: ${targetDirectory}`)
  }

  const blocking = readdirSync(targetDirectory).filter(
    (entry) => !tolerableTargetEntries.has(entry),
  )
  if (blocking.length > 0) {
    throw new Error(
      `target directory is not empty: ${targetDirectory} `
      + `(found ${blocking.slice(0, MAX_REPORTED_BLOCKING_ENTRIES).join(', ')}). Refusing to overwrite existing files.`,
    )
  }
}

/**
 * Profile fragments of .yarnrc.yml contain only a packageExtensions section.
 * The common file keeps packageExtensions as its last section, so a fragment
 * is merged by appending its entries under the existing key.
 */
const mergeYarnrc = (existing, incoming) => {
  const marker = '\npackageExtensions:\n'
  const start = existing.indexOf(marker)
  const tail = start < 0 ? '' : existing.slice(start + marker.length)

  if (start < 0 || /^[A-Za-z]/m.test(tail)) {
    throw new Error(
      '.yarnrc.yml must end with its packageExtensions section to accept fragments',
    )
  }
  if (!incoming.startsWith('packageExtensions:\n')) {
    throw new Error('.yarnrc.yml fragments must contain only a packageExtensions section')
  }

  return `${existing.trimEnd()}\n${incoming.slice('packageExtensions:\n'.length)}`
}

const substitute = (text, values, sourcePath) => {
  return text.replace(placeholderPattern, (_match, name) => {
    if (!(name in values)) {
      throw new Error(`unresolved placeholder {{${name}}} in ${sourcePath}`)
    }
    return values[name]
  })
}

const sortedEntries = (record) => {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  )
}

const mergeManifests = (existing, incoming) => {
  return {
    ...existing,
    ...incoming,
    scripts: { ...existing.scripts, ...incoming.scripts },
    dependencies: { ...existing.dependencies, ...incoming.dependencies },
    devDependencies: { ...existing.devDependencies, ...incoming.devDependencies },
  }
}

const writeTemplateFile = (sourcePath, targetPath, values) => {
  const content = substitute(
    readFileSync(sourcePath, 'utf8'),
    values,
    relative(assetsRoot, sourcePath),
  )
  const fileName = targetPath.slice(targetPath.lastIndexOf('/') + 1)

  mkdirSync(dirname(targetPath), { recursive: true })

  if (existsSync(targetPath)) {
    if (fileName === 'package.json') {
      const merged = mergeManifests(
        JSON.parse(readFileSync(targetPath, 'utf8')),
        JSON.parse(content),
      )
      writeFileSync(targetPath, `${JSON.stringify(merged, null, MANIFEST_INDENT_SPACES)}\n`)
      return
    }
    if (appendableFiles.has(fileName)) {
      writeFileSync(targetPath, `${readFileSync(targetPath, 'utf8').trimEnd()}\n\n${content}`)
      return
    }
    if (fileName === '.yarnrc.yml') {
      writeFileSync(targetPath, mergeYarnrc(readFileSync(targetPath, 'utf8'), content))
      return
    }
    throw new Error(
      `profile conflict: ${relative(assetsRoot, sourcePath)} already exists in target`,
    )
  }

  writeFileSync(targetPath, content)
  chmodSync(targetPath, statSync(sourcePath).mode)
}

const copyTemplateTree = (sourceDirectory, targetDirectory, values) => {
  for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
    const sourcePath = join(sourceDirectory, entry.name)
    const targetPath = join(targetDirectory, entry.name)

    if (entry.isDirectory()) {
      mkdirSync(targetPath, { recursive: true })
      copyTemplateTree(sourcePath, targetPath, values)
    } else {
      writeTemplateFile(sourcePath, targetPath, values)
    }
  }
}

const requireProfile = (versions, profileName) => {
  const profile = versions.profiles[profileName]
  if (profile === undefined) {
    throw new Error(
      `unknown profile ${profileName}; known: ${Object.keys(versions.profiles).join(', ')}`,
    )
  }
  return profile
}

const collectGroups = (versions, groupNames) => {
  return groupNames.reduce((merged, groupName) => {
    const group = versions[groupName]
    if (group === undefined) {
      throw new Error(`unknown dependency group ${groupName}`)
    }
    return { ...merged, ...group }
  }, {})
}

/**
 * Resolves the workspace profiles of a monorepo profile, adding them to the
 * applied profiles and mapping each workspace directory to its profile.
 */
const describeMonorepoWorkspaces = ({
  appliedProfiles,
  profile,
  versions,
  workspaceMap,
  workspaces,
}) => {
  for (const workspaceName of Object.keys(profile.workspaces)) {
    if (workspaceName !== 'shared' && !(workspaceName in workspaces)) {
      throw new Error(`the monorepo profile requires a ${workspaceName} workspace profile`)
    }
  }
  for (const [workspaceName, workspaceProfileName] of Object.entries({
    ...workspaces,
    shared: profile.sharedProfile,
  })) {
    requireProfile(versions, workspaceProfileName)
    appliedProfiles.push(workspaceProfileName)
    workspaceMap[profile.workspaces[workspaceName]] = workspaceProfileName
  }
}

// Dependencies a profile declares before the application's first import of
// them, so Knip would report them as unused in a freshly generated project.
const knipProfileIgnores = {
  monorepo: (scope) => `/^@${scope}\\//`,
  supabase: () => `'@supabase/supabase-js'`,
}

const describeKnipIgnores = (appliedProfiles, scope) => {
  const entries = appliedProfiles
    .filter((profileName) => profileName in knipProfileIgnores)
    .map((profileName) => knipProfileIgnores[profileName](scope))
  if (entries.length === 0) {
    return ''
  }
  return [
    '',
    '    // Declared by the template before the first import. Remove each entry',
    '    // once the code imports it, so an unused declaration is reported again.',
    ...entries.map((entry) => `    ${entry},`),
  ].join('\n')
}

/**
 * Lists every profile the generation applies, in application order, and maps
 * each workspace directory to its profile so the project manifest records the
 * complete composition rather than only the root profiles.
 */
const describeComposition = (versions, profiles, workspaces) => {
  const appliedProfiles = []
  const workspaceMap = {}
  const hasMonorepo = profiles.some(
    (profileName) => requireProfile(versions, profileName).layout === 'monorepo',
  )

  if (!hasMonorepo && Object.keys(workspaces).length > 0) {
    throw new Error('client and server workspaces require the monorepo profile')
  }

  for (const profileName of profiles) {
    const profile = requireProfile(versions, profileName)
    appliedProfiles.push(profileName)

    if (profile.layout === 'monorepo') {
      describeMonorepoWorkspaces({ appliedProfiles, profile, versions, workspaceMap, workspaces })
    }
  }

  return { appliedProfiles, workspaceMap }
}

/**
 * Applies a stack profile inside a workspace directory: the template is copied
 * with the shared configuration path pointing at the repository root, the
 * workspace manifest drops root-only fields and scripts, and dependency groups
 * already hoisted to the root are not repeated.
 */
const generateWorkspace = ({
  hoistedGroups,
  rootDirectory,
  scope,
  targetDirectory,
  values,
  versions,
  withShared,
  workspaceName,
  workspaceProfileName,
}) => {
  const profile = requireProfile(versions, workspaceProfileName)

  mkdirSync(targetDirectory, { recursive: true })
  copyTemplateTree(resolve(assetsRoot, profile.template), targetDirectory, values)
  rmSync(resolve(targetDirectory, 'eslint.config.mjs'), { force: true })

  const yarnrcFragment = resolve(targetDirectory, '.yarnrc.yml')
  if (existsSync(yarnrcFragment)) {
    const rootYarnrc = resolve(rootDirectory, '.yarnrc.yml')
    writeFileSync(
      rootYarnrc,
      mergeYarnrc(readFileSync(rootYarnrc, 'utf8'), readFileSync(yarnrcFragment, 'utf8')),
    )
    rmSync(yarnrcFragment)
  }

  const manifestPath = resolve(targetDirectory, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const hoisted = new Set(hoistedGroups)

  manifest.name = `@${scope}/${workspaceName}`
  delete manifest.packageManager
  delete manifest.engines
  manifest.scripts = Object.fromEntries(
    Object.entries(manifest.scripts).filter(([script]) => !rootOnlyScripts.has(script)),
  )
  manifest.dependencies = sortedEntries({
    ...collectGroups(versions, profile.dependencies),
    ...(withShared ? { [`@${scope}/shared`]: 'workspace:^' } : {}),
  })
  manifest.devDependencies = sortedEntries(
    collectGroups(versions, profile.devDependencies.filter((group) => !hoisted.has(group))),
  )
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, MANIFEST_INDENT_SPACES)}\n`)
}

/**
 * Materializes one or more profiles exactly as the skill documents it: common
 * assets, shared tooling copied into `.config/`, Git hooks, each stack
 * template in order, and a manifest merged from `versions.json`. Overlay
 * profiles append to `.gitignore` and `.env.example` and merge scripts. The
 * optional CI asset is copied last. The target must be empty or absent.
 */
export const generateProject = ({
  targetDirectory,
  projectName,
  profiles,
  workspaces = {},
  ci = 'none',
  htmlLang = 'en',
  securityLevel = 'R1',
  securityRationale = 'Public demonstration content without authentication or personal data.',
  workflow = 'assisted',
}) => {
  if (typeof projectName !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/.test(projectName)) {
    throw new Error('projectName must be a lowercase package name without a scope')
  }
  if (!Array.isArray(profiles) || profiles.length === 0) {
    throw new Error('at least one profile is required')
  }
  if (ci !== 'none' && !existsSync(resolve(assetsRoot, 'ci', ci))) {
    throw new Error(`unknown CI profile ${ci}`)
  }
  if (!['R1', 'R2', 'R3'].includes(securityLevel)) {
    throw new Error('securityLevel must be R1, R2 or R3')
  }
  if (!workflows.has(workflow)) {
    throw new Error('workflow must be assisted or autonomous')
  }

  const versions = readVersions()
  const { appliedProfiles, workspaceMap } = describeComposition(versions, profiles, workspaces)
  const values = {
    ACCESSIBILITY_INVARIANTS:
      '- Meet WCAG 2.2 AA for every user-visible page, state and viewport.',
    ACCESSIBILITY_TARGET: 'WCAG 2.2 AA',
    CI_PROFILE: ci,
    FOUNDATION_VERSION: versions.foundationVersion,
    HTML_LANG: htmlLang,
    NODE_ENGINES: `>=${versions.runtime.nodeMajor}.0.0 <${versions.runtime.nodeMajor + 1}`,
    NODE_MAJOR: String(versions.runtime.nodeMajor),
    PROFILES: appliedProfiles.join(', '),
    PROFILES_YAML: JSON.stringify(appliedProfiles),
    PROJECT_NAME: projectName,
    SECURITY_LEVEL: securityLevel,
    SECURITY_RATIONALE: securityRationale,
    SCOPE: projectName,
    KNIP_PROFILE_IGNORES: describeKnipIgnores(appliedProfiles, projectName),
    WORKFLOW: workflow,
    WORKSPACES_YAML: JSON.stringify(workspaceMap),
    YARN_VERSION: versions.runtime.yarn,
  }
  const rootValues = { ...values, CONFIG_ROOT: './.config' }
  const workspaceValues = { ...values, CONFIG_ROOT: '../../.config' }

  ensureWritableTarget(targetDirectory)
  mkdirSync(targetDirectory, { recursive: true })

  const eslintModules = new Set(
    [...profiles, ...Object.values(workspaces)].flatMap(
      (profileName) => requireProfile(versions, profileName).eslintModules,
    ),
  )

  copyTemplateTree(resolve(assetsRoot, 'common'), targetDirectory, rootValues)
  // Only the ESLint modules a profile uses are copied: an unused module would
  // import plugins the generated project does not install.
  mkdirSync(resolve(targetDirectory, '.config/eslint'), { recursive: true })
  for (const moduleName of eslintModules) {
    writeTemplateFile(
      resolve(assetsRoot, 'tooling/eslint', `${moduleName}.mjs`),
      resolve(targetDirectory, '.config/eslint', `${moduleName}.mjs`),
      rootValues,
    )
  }
  copyTemplateTree(
    resolve(assetsRoot, 'tooling/typescript'),
    resolve(targetDirectory, '.config/typescript'),
    rootValues,
  )
  copyTemplateTree(resolve(assetsRoot, 'tooling/git'), targetDirectory, rootValues)
  copyTemplateTree(resolve(assetsRoot, 'tooling/architecture'), targetDirectory, rootValues)
  copyTemplateTree(
    resolve(assetsRoot, 'tooling/foundation'),
    resolve(targetDirectory, '.config/foundation'),
    rootValues,
  )
  writeFileSync(
    resolve(targetDirectory, '.config/foundation/requirements.json'),
    `${JSON.stringify(readRequirementLevels(), null, MANIFEST_INDENT_SPACES)}\n`,
  )

  let dependencies = {}
  let devDependencies = {}
  let resolutions = {}

  for (const profileName of profiles) {
    const profile = requireProfile(versions, profileName)
    copyTemplateTree(resolve(assetsRoot, profile.template), targetDirectory, rootValues)
    dependencies = { ...dependencies, ...collectGroups(versions, profile.dependencies) }
    devDependencies = { ...devDependencies, ...collectGroups(versions, profile.devDependencies) }
    resolutions = { ...resolutions, ...collectGroups(versions, profile.resolutions ?? []) }

    if (profile.layout === 'monorepo') {
      const selected = { ...workspaces, shared: profile.sharedProfile }
      for (const [workspaceName, workspaceProfileName] of Object.entries(selected)) {
        const workspaceProfile = requireProfile(versions, workspaceProfileName)
        resolutions = {
          ...resolutions,
          ...collectGroups(versions, workspaceProfile.resolutions ?? []),
        }
        generateWorkspace({
          hoistedGroups: profile.devDependencies,
          rootDirectory: targetDirectory,
          scope: projectName,
          targetDirectory: resolve(targetDirectory, profile.workspaces[workspaceName]),
          values: workspaceValues,
          versions,
          withShared: workspaceName !== 'shared',
          workspaceName,
          workspaceProfileName,
        })
      }
    }
  }

  if (ci !== 'none') {
    copyTemplateTree(resolve(assetsRoot, 'ci', ci), targetDirectory, rootValues)
  }

  const manifestPath = resolve(targetDirectory, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.dependencies = sortedEntries(dependencies)
  manifest.devDependencies = sortedEntries(devDependencies)
  if (Object.keys(resolutions).length > 0) {
    manifest.resolutions = sortedEntries(resolutions)
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, MANIFEST_INDENT_SPACES)}\n`)

  return { targetDirectory, values, versions, appliedProfiles, workspaceMap }
}

const usage = `usage: generate-project.mjs --target <dir> --name <package-name> --profile <profile>...
  [--client <profile>] [--server <profile>] [--ci gitlab]
  [--security-level R1|R2|R3] [--security-rationale <text>] [--html-lang <bcp47>]
  [--workflow assisted|autonomous]

Profiles are applied in order; overlays such as supabase follow a base profile.
The monorepo profile requires --client and --server. The target directory must
not exist or must be empty (a fresh .git directory is tolerated).`

const runCli = (argv) => {
  const { values } = parseArgs({
    args: argv,
    options: {
      'target': { type: 'string' },
      'name': { type: 'string' },
      'profile': { type: 'string', multiple: true },
      'client': { type: 'string' },
      'server': { type: 'string' },
      'ci': { type: 'string', default: 'none' },
      'security-level': { type: 'string', default: 'R1' },
      'security-rationale': { type: 'string' },
      'html-lang': { type: 'string', default: 'en' },
      'workflow': { type: 'string', default: 'assisted' },
      'help': { type: 'boolean', default: false },
    },
  })

  if (values.help) {
    process.stdout.write(`${usage}\n`)
    return
  }
  if (values.target === undefined || values.name === undefined || values.profile === undefined) {
    throw new Error(`--target, --name and at least one --profile are required\n${usage}`)
  }

  const workspaces = {}
  if (values.client !== undefined) {
    workspaces.client = values.client
  }
  if (values.server !== undefined) {
    workspaces.server = values.server
  }

  const result = generateProject({
    targetDirectory: resolve(values.target),
    projectName: values.name,
    profiles: values.profile,
    workspaces,
    ci: values.ci,
    htmlLang: values['html-lang'],
    securityLevel: values['security-level'],
    workflow: values.workflow,
    ...(values['security-rationale'] === undefined
      ? {}
      : { securityRationale: values['security-rationale'] }),
  })

  process.stdout.write(
    [
      `generated ${result.targetDirectory}`,
      `profiles: ${result.appliedProfiles.join(', ')}`,
      `workspaces: ${JSON.stringify(result.workspaceMap)}`,
      `security: ${values['security-level']}; ci: ${values.ci}; workflow: ${values.workflow}`,
      'next: ensure-git-root.mjs, corepack yarn install, corepack yarn validate',
    ].join('\n') + '\n',
  )
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

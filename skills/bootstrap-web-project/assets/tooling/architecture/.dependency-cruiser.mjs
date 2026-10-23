// STRUCT-BOUNDARY-001, STRUCT-SHARED-001 and DEP-MINIMAL-001: the module
// boundaries and the dependency classes of the project, checked by `lint:deps`.
// Import cycles are already rejected by `import/no-cycle` in the ESLint
// configuration, so they are not repeated here.
//
// STRUCT-PORT-001: infrastructure packages and generated clients are imported
// only by adapters.
//
// This file belongs to the foundation. Put project additions in
// `.dependency-cruiser.local.mjs`, which default-exports
// `{ forbidden, options, ports }`: its rules are added (a rule with the same
// name replaces the foundation's), its options override these, for example
// `tsConfig` for path aliases, and `ports.packages`, `ports.adapterPaths` and
// `ports.confinedPaths` extend the infrastructure packages, the adapter paths
// and the confined paths below. Paths are regular expressions, so an adapter
// path can name files as well as folders, such as `\.data\.ts$`.

import { existsSync } from 'node:fs'
import { URL } from 'node:url'

const localConfigUrl = new URL('.dependency-cruiser.local.mjs', import.meta.url)
const local = existsSync(localConfigUrl) ? (await import(localConfigUrl.href)).default : {}
const localRules = local.forbidden ?? []
const localRuleNames = new Set(localRules.map((rule) => rule.name))

// Paths are relative to the root `lint:deps` runs from: the project's `src/`,
// a workspace's under `apps/` or `packages/`, or one in a top-level folder of a
// retrofitted layout such as `server/src/`.
const productionSource = String.raw`^(src|[^/]+/src|(apps|packages)/[^/]+/src)/`
const testSource = String.raw`(^|/)(test|e2e)/|\.(test|spec)\.[cm]?[jt]sx?$`

// Infrastructure services, not frameworks: databases and ORMs, queues, cloud
// SDKs, identity, email, logging and payments. A scope ends with `/`.
const infrastructurePackages = [
  '@prisma/', 'pg', 'postgres', 'mysql2', 'mongodb', 'mongoose', 'drizzle-orm',
  'kysely', 'typeorm', 'sequelize', 'pg-boss', 'bullmq', 'bull', 'ioredis',
  'redis', '@google-cloud/', 'google-auth-library', 'firebase', 'firebase-admin',
  '@aws-sdk/', '@azure/', '@supabase/supabase-js', 'better-auth', 'pino',
  'winston', 'nodemailer', 'resend', '@sendgrid/', 'stripe', '@paypal/',
  ...local.ports?.packages ?? [],
]
// Project code that only adapters may import, such as a generated ORM client.
// It imports the vendor by construction, so it is an adapter path too.
const confinedPaths = [
  String.raw`(^|/)src/generated/`,
  ...local.ports?.confinedPaths ?? [],
]
const adapterPaths = [
  String.raw`(^|/)src/(infrastructure|db|adapters)/`,
  ...confinedPaths,
  ...local.ports?.adapterPaths ?? [],
]
const escapePackage = (name) => name.replaceAll(/[.+]/g, String.raw`\$&`)
const packagePattern = (name) => (name.endsWith('/') ? `${escapePackage(name)}[^/]+` : escapePackage(name))
const infrastructureModule = `(^|/)node_modules/(${infrastructurePackages.map(packagePattern).join('|')})/`

const foundationRules = [
  {
    name: 'not-to-unresolvable',
    comment: 'An import must resolve. Workspace packages resolve to their build output, '
      + 'which does not exist before the build, so they are checked by the typecheck.',
    severity: 'error',
    from: {},
    to: { couldNotResolve: true, pathNot: '^@{{SCOPE}}/' },
  },
  {
    name: 'no-non-package-json',
    comment: 'A package used by the code is declared in a package.json.',
    severity: 'error',
    from: {},
    to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
  },
  {
    name: 'not-to-dev-dep',
    comment: 'Production code does not import development dependencies.',
    severity: 'error',
    from: { path: productionSource, pathNot: testSource },
    // A `/// <reference types>` only brings ambient types, such as vite/client.
    to: {
      dependencyTypes: ['npm-dev'],
      dependencyTypesNot: ['type-only', 'triple-slash-type-reference'],
    },
  },
  {
    name: 'no-duplicate-dep-types',
    comment: 'A package is declared once, as either a dependency or a development dependency.',
    severity: 'error',
    from: {},
    to: { moreThanOneDependencyType: true, dependencyTypesNot: ['type-only'] },
  },
  {
    name: 'no-deprecated-core',
    comment: 'Deprecated Node.js core modules are not used.',
    severity: 'error',
    from: {},
    to: { dependencyTypes: ['core'], path: '^(punycode|domain|constants|sys|_linklist|_stream_wrap)$' },
  },
  {
    name: 'infrastructure-only-in-adapters',
    comment: 'STRUCT-PORT-001: an infrastructure package is imported only by its adapter, '
      + 'types included; feature code uses the project\'s port.',
    severity: 'error',
    from: { path: productionSource, pathNot: [testSource, ...adapterPaths] },
    to: { path: infrastructureModule },
  },
  {
    name: 'generated-clients-only-in-adapters',
    comment: 'STRUCT-PORT-001: a generated client is imported only by an adapter, '
      + 'types included, like the vendor package it wraps.',
    severity: 'error',
    from: { path: productionSource, pathNot: [testSource, ...adapterPaths] },
    to: { path: confinedPaths },
  },
  {
    name: 'no-client-to-server',
    comment: 'The client reaches the server through its HTTP contract, never by import.',
    severity: 'error',
    from: { path: '^apps/client/' },
    to: { path: '^apps/server/' },
  },
  {
    name: 'no-server-to-client',
    comment: 'The server never imports client code.',
    severity: 'error',
    from: { path: '^apps/server/' },
    to: { path: '^apps/client/' },
  },
  {
    name: 'no-package-to-app',
    comment: 'Shared packages are imported by applications, never the reverse.',
    severity: 'error',
    from: { path: '^packages/' },
    to: { path: '^apps/' },
  },
]

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    ...foundationRules.filter((rule) => !localRuleNames.has(rule.name)),
    ...localRules,
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Build output and tool directories of the project and its workspaces; the
    // output of installed packages stays visible so dependency types resolve.
    exclude: {
      path: [
        String.raw`^(dist|coverage|\.config|\.yarn)/`,
        String.raw`^[^/]+/(dist|coverage)/`,
        String.raw`^(apps|packages)/[^/]+/(dist|coverage)/`,
      ],
    },
    combinedDependencies: true,
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'],
    },
    ...local.options,
  },
}

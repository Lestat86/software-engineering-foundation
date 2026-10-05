// STRUCT-BOUNDARY-001, STRUCT-SHARED-001 and DEP-MINIMAL-001: the module
// boundaries and the dependency classes of the project, checked by `lint:deps`.
// Import cycles are already rejected by `import/no-cycle` in the ESLint
// configuration, so they are not repeated here.

const productionSource = String.raw`^(src|apps/[^/]+/src|packages/[^/]+/src)/`
const testSource = String.raw`(^|/)(test|e2e)/|\.(test|spec)\.[cm]?[jt]sx?$`

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
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
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'] },
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
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Build output and tool directories of the project and its workspaces; the
    // output of installed packages stays visible so dependency types resolve.
    exclude: {
      path: [
        String.raw`^(dist|coverage|\.config|\.yarn)/`,
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
  },
}

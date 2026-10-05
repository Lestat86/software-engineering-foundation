// DEP-MINIMAL-001 and CORE-DEBT-001: unused files, exports and dependencies,
// checked by `premerge`. Each ignored dependency is used in a way Knip cannot
// trace; keep the list to those cases.

/** @type {import('knip').KnipConfig} */
export default {
  ignoreDependencies: [
    // Run by the Git hooks through `corepack yarn`.
    '@commitlint/cli',
    'lint-staged',
    // Loaded by name from `.secretlintrc.json`.
    '@secretlint/secretlint-rule-preset-recommend',{{KNIP_PROFILE_IGNORES}}
  ],
}

// DEP-MINIMAL-001 and CORE-DEBT-001: unused files, exports and dependencies,
// checked by `premerge`. Each ignored dependency is used in a way Knip cannot
// trace; keep the list to those cases.
//
// This file belongs to the foundation. Put project options in `knip.local.js`,
// which default-exports a Knip configuration: its options are applied, and its
// `ignore` and `ignoreDependencies` entries are added to the ones below.

import { existsSync } from 'node:fs'
import { URL } from 'node:url'

const localConfigUrl = new URL('knip.local.js', import.meta.url)
const local = existsSync(localConfigUrl) ? (await import(localConfigUrl.href)).default : {}

/** @type {import('knip').KnipConfig} */
export default {
  ...local,
  ignore: local.ignore ?? [],
  ignoreDependencies: [
    // Run by the Git hooks through `corepack yarn`.
    '@commitlint/cli',
    'lint-staged',
    // Loaded by name from `.secretlintrc.json`.
    '@secretlint/secretlint-rule-preset-recommend',
    ...local.ignoreDependencies ?? [],
  ],
}

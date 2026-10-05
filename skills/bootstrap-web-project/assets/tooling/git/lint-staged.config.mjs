export default {
  '*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}': 'eslint --fix --max-warnings=0',
  // GIT-SECRET-001: every staged file, whatever its type, is scanned for secrets.
  '*': 'secretlint',
}

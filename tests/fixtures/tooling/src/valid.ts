import { MAX_LABEL_LENGTH } from './valid.constants.ts'

// TODO(#123): normalize locale-specific whitespace once the issue settles it.
export const normalizeLabel = (value: string): string =>
  value.trim().toLocaleLowerCase()

export const isOversized = (value: string): boolean =>
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers -- described fixture
  value.length > MAX_LABEL_LENGTH * 2

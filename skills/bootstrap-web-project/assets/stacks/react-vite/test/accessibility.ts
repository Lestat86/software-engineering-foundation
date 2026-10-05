import axe, { type AxeResults, type Result, type RunOptions } from 'axe-core'
import { expect } from 'vitest'

// Component fragments are not complete pages. Landmark containment and color
// contrast are verified by the browser-level scans in `e2e/` and by manual
// review; every other axe-core rule runs here against the rendered state.
const componentScanOptions: RunOptions = {
  resultTypes: ['violations', 'incomplete'],
  rules: {
    'color-contrast': { enabled: false },
    'region': { enabled: false },
  },
}

const describeResults = (results: Result[]): string =>
  results
    .map((result) => {
      const targets = result.nodes.map((node) => node.target.join(' ')).join(', ')
      return `${result.id} (${result.impact ?? 'unknown'}): ${result.help} -> ${targets}`
    })
    .join('\n')

const scanAccessibility = async (context: Element): Promise<AxeResults> =>
  axe.run(context, componentScanOptions)

/**
 * Fails on violations and on results that axe-core could not determine. An
 * incomplete result must be resolved or suppressed at the narrowest rule and
 * target only after its manual verification record exists.
 */
export const expectNoAccessibilityViolations = async (
  context: Element,
): Promise<void> => {
  const results = await scanAccessibility(context)

  expect(describeResults(results.violations), 'axe-core violations').toBe('')
  expect(
    describeResults(results.incomplete),
    'axe-core incomplete results require manual verification',
  ).toBe('')
}

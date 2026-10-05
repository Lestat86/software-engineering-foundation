// TODO: tracked nowhere
// FIXME this marker has no issue either

// const legacyLabel = value.trim().toUpperCase();

export const scaleLabel = (value: string): number =>
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  value.length * 3

export const classify = (a: number, b: number, c: number, d: number, e: number): string => {
  if (a > 0) {
    if (b > 0) {
      if (c > 0) {
        if (d > 0) {
          if (e > 0) {
            return 'all'
          } else {
            return 'four'
          }
        } else {
          return 'three'
        }
      } else {
        return 'two'
      }
    } else {
      return 'one'
    }
  } else {
    return 'none'
  }
}

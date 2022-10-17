export const toPercent = (num: number) => {
  if (num >= 1) {
    return 100
  } else if (Math.sign(num) === -1 || num === 0 || Number.isNaN(num)) {
    return 0
  } else if (Math.round(num * 100) === 0) {
    return 1
  } else {
    return Math.round(num * 100)
  }
}

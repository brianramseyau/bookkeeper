/** A round "nice" step for a span of roughly `rough` per gridline, snapped
    to a 1/2/5/10 (times a power of ten) breakpoint - shared by `niceMax`
    and `niceDomain` so their rounding rule can't drift apart. */
function niceStep(rough: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / magnitude
  return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude
}

/** A round "nice" ceiling and step for a chart's y-axis, ~4 gridlines. */
export function niceMax(value: number): { max: number; step: number } {
  if (value <= 0) return { max: 100, step: 25 }
  const step = niceStep(value / 4)
  return { max: step * 4, step }
}

/**
 * Like `niceMax`, but for a y-axis that may need to dip below zero (e.g. a
 * net-position line over income/expense bars) - `min`/`max` describe the
 * actual data's range, and the returned domain always includes zero even
 * when every value is on one side of it.
 */
export function niceDomain(min: number, max: number): { min: number; max: number; step: number } {
  const hi = Math.max(max, 0)
  const lo = Math.min(min, 0)
  if (hi === 0 && lo === 0) return { min: 0, max: 100, step: 25 }
  const step = niceStep((hi - lo) / 4)
  return {
    min: lo < 0 ? -Math.ceil(-lo / step) * step : 0,
    max: Math.ceil(hi / step) * step,
    step,
  }
}

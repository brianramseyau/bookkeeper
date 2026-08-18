/** A round "nice" ceiling and step for a chart's y-axis, ~4 gridlines. */
export function niceMax(value: number): { max: number; step: number } {
  if (value <= 0) return { max: 100, step: 25 }
  const rough = value / 4
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / magnitude
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude
  return { max: step * 4, step }
}

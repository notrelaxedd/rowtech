// Axis maths shared by the dashboard's canvas charts.

/** The smallest round step (1, 2 or 5 times a power of ten) that is at least `raw`. */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

/**
 * Grid values from 0 up to `top`, a round step apart and about `count` of
 * them: three to six lines whether the axis is 60 kg or 500,000 raw counts.
 */
export function gridTicks(top: number, count = 5): number[] {
  if (!(top > 0) || !Number.isFinite(top)) return [0];
  const step = niceStep(top / count);
  // Enough decimals for the step, so 0.1 + 0.2 is labelled 0.3.
  const digits = Math.max(0, -Math.floor(Math.log10(step)));
  const ticks: number[] = [];
  for (let i = 0; i * step <= top; i++) ticks.push(Number((i * step).toFixed(digits)));
  return ticks;
}

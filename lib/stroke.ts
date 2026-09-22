// Example stroke data for the marketing site. Same simulated session as the
// device mock-ups rendered by loadcell/ui_screens_v9/render_tft.py, so the
// numbers on the page match the numbers on the pictured screens.

export const EXAMPLE = {
  spm: 28.4,
  strokes: 147,
  driveMs: 782,
  recoveryMs: 1329,
  peakKg: 61.42,
  peakPct: 38,
  impulse: 28.914,
  riseKgPerS: 182.6,
  cvPct: 3.2,
  thirds: [8.412, 13.905, 6.598] as const,
  catchFrac: 0.15, // catch threshold as a fraction of the reference peak
} as const

/** Normalised drive shape, 0..1 over the drive, peaking at `peakPos`. */
export function driveShape(u: number, peakPos: number = EXAMPLE.peakPct / 100) {
  if (u <= 0 || u >= 1) return 0
  const s = u < peakPos ? u / peakPos : 1 - (u - peakPos) / (1 - peakPos)
  return Math.sin((s * Math.PI) / 2) ** 1.6
}

// Deterministic 0..1 from an integer, so server and client render identical curves.
export function hash01(n: number) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** Seat force in kg at session time t (s). */
export function forceAt(t: number, seed = 0) {
  const period = 60 / EXAMPLE.spm
  const drive = EXAMPLE.driveMs / 1000
  const k = Math.floor(t / period)
  const ph = t - k * period
  const peak = EXAMPLE.peakKg * (0.94 + 0.08 * hash01(k * 31 + seed))
  if (ph < drive) return peak * driveShape(ph / drive)
  return -0.35 * Math.sin(((ph - drive) / (period - drive)) * Math.PI)
}

/** Ramer-Douglas-Peucker: drop points within `tol` of the line through their neighbours. */
function simplify(pts: Array<[number, number]>, tol: number): Array<[number, number]> {
  if (pts.length < 3) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack: Array<[number, number]> = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const [ax, ay] = pts[a]
    const [bx, by] = pts[b]
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    let far = -1
    let dmax = tol
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / len
      if (d > dmax) {
        dmax = d
        far = i
      }
    }
    if (far >= 0) {
      keep[far] = 1
      stack.push([a, far], [far, b])
    }
  }
  return pts.filter((_, i) => keep[i])
}

/** SVG path through the points. Server-rendered curves pass a tolerance (in
 *  viewBox units) so the page ships the shape, not every sample. */
export function toPath(pts: Array<[number, number]>, tol = 0) {
  const ps = tol > 0 ? simplify(pts, tol) : pts
  return ps.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("")
}

// -----------------------------------------------------------------------------
// One stroke, measured the way sensor.cpp measures it: sampled at 80 SPS,
// catch where force crosses catchFrac x reference peak (interpolated between
// samples), release at half that threshold, trapezoidal impulse.
// -----------------------------------------------------------------------------
export const SPS = 80
const PERIOD = 60 / EXAMPLE.spm
// Onset-to-zero length of the force pulse. Chosen so the threshold-to-threshold
// drive the detector reports comes out at EXAMPLE.driveMs.
export const PULSE_S = 0.924

export type StrokeVariant = { k: number; pp: number; ds: number }

export function strokeForce(t: number, v: StrokeVariant = { k: 1, pp: 0.38, ds: 1 }) {
  const d = PULSE_S * v.ds
  if (t < 0) return 0
  if (t < d) return EXAMPLE.peakKg * v.k * driveShape(t / d, v.pp)
  return -0.35 * Math.sin(((t - d) / (PERIOD - d)) * Math.PI)
}

export type Measured = {
  samples: Array<[number, number]>
  threshold: number
  catchT: number
  releaseT: number
  peakT: number
  peakKg: number
  peakPct: number
  driveMs: number
  recoveryMs: number
  impulse: number
  thirds: [number, number, number]
  rise: number
}

export function measureStroke(v?: StrokeVariant, phase = 0.0047): Measured {
  const dt = 1 / SPS
  const samples: Array<[number, number]> = []
  for (let t = -0.15 + phase; t < 1.3; t += dt) samples.push([t, strokeForce(t, v)])
  const threshold = EXAMPLE.catchFrac * EXAMPLE.peakKg
  const cross = (from: number, level: number, rising: boolean) => {
    for (let i = Math.max(1, from); i < samples.length; i++) {
      const [t0, a] = samples[i - 1]
      const [, b] = samples[i]
      if (rising ? a < level && b >= level : a >= level && b < level)
        return { i, t: t0 + ((level - a) / (b - a)) * dt }
    }
    throw new Error("no crossing")
  }
  const c = cross(1, threshold, true)
  let pi = c.i
  for (let i = c.i; i < samples.length && samples[i][1] >= threshold / 2; i++)
    if (samples[i][1] > samples[pi][1]) pi = i
  const r = cross(pi, threshold / 2, false)
  const integrate = (a: number, b: number) => {
    let sum = 0
    for (let t = a; t < b; t += 0.001) sum += strokeForce(Math.min(t + 0.0005, b), v) * Math.min(0.001, b - t)
    return sum
  }
  const drive = r.t - c.t
  const third = drive / 3
  const at = (t: number) => strokeForce(t, v)
  return {
    samples,
    threshold,
    catchT: c.t,
    releaseT: r.t,
    peakT: samples[pi][0],
    peakKg: samples[pi][1],
    peakPct: ((samples[pi][0] - c.t) / drive) * 100,
    driveMs: drive * 1000,
    recoveryMs: (PERIOD - drive) * 1000,
    impulse: integrate(c.t, r.t),
    thirds: [integrate(c.t, c.t + third), integrate(c.t + third, c.t + 2 * third), integrate(c.t + 2 * third, r.t)],
    rise: (at(c.t + 0.1) - threshold) / 0.1,
  }
}

/** The last eight strokes, for the consistency figure. Stroke 0 is the one shown. */
export function recentStrokes(): StrokeVariant[] {
  return Array.from({ length: 8 }, (_, i) =>
    i === 0
      ? { k: 1, pp: 0.38, ds: 1 }
      : { k: 0.955 + 0.09 * hash01(i * 7), pp: 0.36 + 0.04 * hash01(i * 13), ds: 0.975 + 0.05 * hash01(i * 19) }
  )
}

export function impulseCv(strokes: StrokeVariant[]) {
  const xs = strokes.map((s) => measureStroke(s).impulse)
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1))
  return (sd / mean) * 100
}

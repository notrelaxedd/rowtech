// The node's stroke detector, ported from LoadCellNode_v9/sensor.cpp
// (strokeService, extractDrive, sensorConsistencyCV) so the page can run it
// live on a visitor's input. Same state machine, same thresholds, same
// interpolated crossings; timestamps are float ms instead of uint32.

export const NODE = {
  catchFrac: 0.15, // catch threshold = catchFrac x reference peak...
  noiseFloorMult: 5, // ...floored at this many times the noise
  minDriveMs: 250,
  minRecoveryMs: 250,
  idleMs: 5000,
  sampleMs: 1000 / 80,
  cvWindow: 8,
} as const

export type Sample = readonly [t: number, v: number]

export type Stroke = {
  seq: number
  threshold: number
  catchT: number
  /** How far past the sample before it the interpolated catch fell, ms. */
  catchLagMs: number
  releaseT: number
  driveMs: number
  /** Known only when the next catch lands; null if the rower stopped. */
  recoveryMs: number | null
  peakKg: number
  peakT: number
  peakPct: number
  impulse: number
  thirds: [number, number, number]
  rise: number
}

export type DetectorEvent =
  | { kind: "catch"; t: number; completed: Stroke | null }
  | { kind: "release"; stroke: Stroke }
  | { kind: "discard"; driveMs: number }
  | { kind: "idle"; completed: Stroke | null }

export type DetectorState = "idle" | "drive" | "recovery"

/** Linear interpolation over time-ordered samples, clamped at both ends. */
export function valueAt(s: readonly Sample[], t: number) {
  if (!s.length) return 0
  if (t <= s[0][0]) return s[0][1]
  for (let i = 1; i < s.length; i++) {
    const [tb, vb] = s[i]
    if (t <= tb) {
      const [ta, va] = s[i - 1]
      return tb === ta ? vb : va + (vb - va) * ((t - ta) / (tb - ta))
    }
  }
  return s[s.length - 1][1]
}

/** Thirds (trapezoidal, split at the boundaries) and the 100 ms rise rate. */
function extractDrive(s: readonly Sample[], t0: number, t1: number) {
  const span = Math.max(t1 - t0, 1e-6)
  const b1 = t0 + span / 3
  const b2 = t0 + (2 * span) / 3
  const thirds: [number, number, number] = [0, 0, 0]
  for (let k = 1; k < s.length; k++) {
    const ta = Math.max(s[k - 1][0], t0)
    const tb = Math.min(s[k][0], t1)
    if (tb <= ta) continue
    const edges = [ta, Math.max(ta, Math.min(b1, tb)), Math.max(ta, Math.min(b2, tb)), tb]
    for (let e = 0; e < 3; e++) {
      const sa = edges[e]
      const sb = edges[e + 1]
      if (sb <= sa) continue
      const bucket = sa < b1 ? 0 : sa < b2 ? 1 : 2
      thirds[bucket] += 0.5 * (valueAt(s, sa) + valueAt(s, sb)) * ((sb - sa) / 1000)
    }
  }
  const rt = Math.min(span, 100)
  const rise = (valueAt(s, t0 + rt) - valueAt(s, t0)) / (rt / 1000)
  return { thirds, rise }
}

export class StrokeDetector {
  state: DetectorState = "idle"
  refPeak = 0
  private prev: Sample | null = null
  private seq = 0
  private driveStart = 0
  private driveLag = 0
  private driveThr = 0
  private drivePeak = 0
  private drivePeakT = 0
  private driveSamples: Sample[] = []
  private pending: Stroke | null = null
  private pendingRel = 0
  readonly noise: number

  constructor(noise: number) {
    this.noise = noise
  }

  threshold() {
    return Math.max(NODE.catchFrac * this.refPeak, NODE.noiseFloorMult * this.noise)
  }

  private complete(recoveryEnd: number | null) {
    const s = this.pending
    if (!s) return null
    s.recoveryMs = recoveryEnd === null ? null : recoveryEnd - this.pendingRel
    this.pending = null
    return s
  }

  push(t: number, v: number): DetectorEvent[] {
    const p = this.prev
    this.prev = [t, v]
    if (!p) return []
    const [tp, vp] = p
    const thr = this.threshold()
    const rel = thr * 0.5

    if (this.state !== "drive") {
      if (vp < thr && v >= thr) {
        const f = v !== vp ? (thr - vp) / (v - vp) : 0
        const tc = tp + f * (t - tp)
        if (this.state === "recovery" && tc - this.pendingRel < NODE.minRecoveryMs) return []
        const completed = this.complete(tc)
        this.state = "drive"
        this.driveStart = tc
        this.driveLag = tc - tp
        this.driveThr = thr
        this.drivePeak = v
        this.drivePeakT = t
        this.driveSamples = [p, [t, v]]
        return [{ kind: "catch", t: tc, completed }]
      }
      if (this.state === "recovery" && t - this.pendingRel > NODE.idleMs) {
        this.state = "idle"
        return [{ kind: "idle", completed: this.complete(null) }]
      }
      return []
    }

    // Drive.
    this.driveSamples.push([t, v])
    if (v > this.drivePeak) {
      this.drivePeak = v
      this.drivePeakT = t
    }
    if (!(vp > rel && v <= rel)) return []

    const f = v !== vp ? (rel - vp) / (v - vp) : 0
    const tr = tp + f * (t - tp)
    const dur = tr - this.driveStart
    if (dur < NODE.minDriveMs) {
      // A bump, a knock, or noise riding the threshold: no stroke.
      this.state = "idle"
      return [{ kind: "discard", driveMs: dur }]
    }
    const { thirds, rise } = extractDrive(this.driveSamples, this.driveStart, tr)
    const stroke: Stroke = {
      seq: ++this.seq,
      threshold: this.driveThr,
      catchT: this.driveStart,
      catchLagMs: this.driveLag,
      releaseT: tr,
      driveMs: dur,
      recoveryMs: null,
      peakKg: this.drivePeak,
      peakT: this.drivePeakT,
      peakPct: Math.min(100, Math.max(0, ((this.drivePeakT - this.driveStart) / dur) * 100)),
      impulse: thirds[0] + thirds[1] + thirds[2],
      thirds,
      rise,
    }
    this.pending = stroke
    this.pendingRel = tr
    this.state = "recovery"
    this.refPeak = this.refPeak <= 0 ? this.drivePeak : this.refPeak * 0.7 + this.drivePeak * 0.3
    return [{ kind: "release", stroke }]
  }
}

/** Impulse CV over the most recent strokes (newest first), as the node reports it. */
export function consistencyCv(strokes: readonly Stroke[]) {
  const xs = strokes.slice(0, NODE.cvWindow).map((s) => s.impulse)
  if (xs.length < 3) return null
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  if (Math.abs(mean) < 1e-9) return null
  const ss = xs.reduce((a, b) => a + (b - mean) ** 2, 0)
  return (Math.sqrt(ss / (xs.length - 1)) / Math.abs(mean)) * 100
}

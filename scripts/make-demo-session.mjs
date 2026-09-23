// Builds the bundled sample session for /demo and the Playwright upload test.
//
// It writes exactly what LoadCellNode_v10/storage.cpp writes -- same header,
// same column order, same %.4f/%.5f shapes, same fixed 128-byte curve records
// -- so the demo and the tests go through the real parser, not a shortcut.
// Synthetic, and labelled as sample data everywhere it is shown.
//
//   node scripts/make-demo-session.mjs
//
// Deterministic: same bytes every run.
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "demo");

const SPS = 80;
const CURVE_POINTS = 64;
const CURVE_SCALE = 10000;
const STROKES = 147;
const SPM = 28.4;
const PERIOD_S = 60 / SPM;
const CATCH_FRAC = 0.15; // of the recent peak, as the firmware's detector uses
const PULSE_S = 0.924;

// Eight seats: how hard, how the drive is shaped, and how much each varies.
// Bow (1) and 5 seat are the crew's early and late catches on the marketing
// page; the same characters show up here.
const SEATS = [
  { seat: 1, name: "bow", peak: 58.4, peakPos: 0.395, jitter: 0.045, lag: -9 },
  { seat: 2, name: "", peak: 56.9, peakPos: 0.41, jitter: 0.06, lag: 9 },
  { seat: 3, name: "", peak: 62.3, peakPos: 0.375, jitter: 0.035, lag: -2 },
  { seat: 4, name: "", peak: 60.1, peakPos: 0.385, jitter: 0.04, lag: 3 },
  { seat: 5, name: "", peak: 55.2, peakPos: 0.43, jitter: 0.075, lag: 11 },
  { seat: 6, name: "", peak: 63.8, peakPos: 0.37, jitter: 0.03, lag: -4 },
  { seat: 7, name: "", peak: 58.0, peakPos: 0.4, jitter: 0.05, lag: 6 },
  { seat: 8, name: "stroke", peak: 61.4, peakPos: 0.38, jitter: 0.033, lag: 0 },
];

/** Deterministic 0..1 from an integer. */
function hash01(n) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Normalised drive shape, 0..1 over the drive, peaking at peakPos. */
function driveShape(u, peakPos) {
  if (u <= 0 || u >= 1) return 0;
  const s = u < peakPos ? u / peakPos : 1 - (u - peakPos) / (1 - peakPos);
  return Math.sin((s * Math.PI) / 2) ** 1.6;
}

/** Force (kg) at time t after the stroke's onset. */
function force(t, v) {
  const d = PULSE_S * v.ds;
  if (t < 0) return 0;
  if (t < d) return v.peak * driveShape(t / d, v.pp);
  // A little negative through the recovery: the handle's own weight.
  return -0.35 * Math.sin(((t - d) / (PERIOD_S - d)) * Math.PI);
}

/** One stroke, measured the way sensor.cpp measures it. */
function measure(v, onset, refPeak) {
  const dt = 1 / SPS;
  const threshold = CATCH_FRAC * refPeak;
  const samples = [];
  for (let t = -0.2; t < PERIOD_S; t += dt) samples.push([t, force(t, v)]);

  const cross = (from, level, rising) => {
    for (let i = Math.max(1, from); i < samples.length; i++) {
      const [t0, a] = samples[i - 1];
      const [, b] = samples[i];
      if (rising ? a < level && b >= level : a >= level && b < level) {
        return { i, t: t0 + ((level - a) / (b - a)) * dt };
      }
    }
    return null;
  };
  const c = cross(1, threshold, true);
  if (!c) return null;
  let pi = c.i;
  for (let i = c.i; i < samples.length && samples[i][1] >= threshold / 2; i++) {
    if (samples[i][1] > samples[pi][1]) pi = i;
  }
  const r = cross(pi, threshold / 2, false);
  if (!r) return null;

  const integrate = (a, b) => {
    let sum = 0;
    const step = 0.0005;
    for (let t = a; t < b; t += step) sum += force(Math.min(t + step / 2, b), v) * Math.min(step, b - t);
    return sum;
  };
  const drive = r.t - c.t;
  const third = drive / 3;
  return {
    catchMs: Math.round((onset + c.t) * 1000),
    driveMs: Math.round(drive * 1000),
    peak: samples[pi][1],
    peakPosPct: Math.round(((samples[pi][0] - c.t) / drive) * 100),
    impulse: integrate(c.t, r.t),
    riseRate: (force(c.t + 0.1, v) - threshold) / 0.1,
    thirds: [integrate(c.t, c.t + third), integrate(c.t + third, c.t + 2 * third), integrate(c.t + 2 * third, r.t)],
    // The 64-point curve: the drive, normalised to this stroke's own peak.
    curve: Array.from({ length: CURVE_POINTS }, (_, i) => {
      const t = c.t + ((r.t - c.t) * i) / (CURVE_POINTS - 1);
      return Math.max(-32768, Math.min(32767, Math.round((force(t, v) / samples[pi][1]) * CURVE_SCALE)));
    }),
  };
}

function buildSeat(cfg) {
  const strokes = [];
  const curves = [];
  // The node boots, sits on the rack, then the crew pushes off.
  const bootOffset = 41.3 + cfg.seat * 0.7;
  let refPeak = cfg.peak;

  for (let k = 0; k < STROKES; k++) {
    // The piece: a steadier middle, a push in the last twenty.
    const drift = k < 20 ? 0.97 + 0.0015 * k : k > STROKES - 21 ? 1.0 + 0.0025 * (k - (STROKES - 21)) : 1.0;
    const v = {
      peak: cfg.peak * drift * (1 + cfg.jitter * (hash01(k * 31 + cfg.seat * 7) - 0.5)),
      pp: cfg.peakPos + 0.03 * (hash01(k * 17 + cfg.seat * 13) - 0.5),
      ds: 1 + 0.05 * (hash01(k * 11 + cfg.seat * 3) - 0.5),
    };
    const onset = bootOffset + k * PERIOD_S + cfg.lag / 1000 + 0.004 * (hash01(k * 5 + cfg.seat) - 0.5);
    const m = measure(v, onset, refPeak);
    if (!m) continue;
    refPeak = refPeak * 0.8 + m.peak * 0.2; // the detector tracks recent peaks
    strokes.push(m);
    curves.push(m.curve);
  }

  // recovery_ms is only known at the following catch, as on the node.
  const rows = strokes.map((s, i) => {
    const next = strokes[i + 1];
    const recovery = next ? next.catchMs - s.catchMs - s.driveMs : Math.round(PERIOD_S * 1000) - s.driveMs;
    return { ...s, recoveryMs: recovery };
  });

  return { rows, curves };
}

/** storage.cpp writes "%lu,%lu,%lu,%u,%u,%.4f,%u,%.5f,%.4f,%.5f,%.5f,%.5f,%d". */
function strokesCsv(rows) {
  const header = "rec,seq,catch_ms,drive_ms,recovery_ms,peak,peak_pos_pct,impulse,rise_rate,third1,third2,third3,curve_valid\n";
  const body = rows
    .map((s, i) =>
      [
        i,
        i + 1,
        s.catchMs,
        s.driveMs,
        s.recoveryMs,
        s.peak.toFixed(4),
        s.peakPosPct,
        s.impulse.toFixed(5),
        s.riseRate.toFixed(4),
        s.thirds[0].toFixed(5),
        s.thirds[1].toFixed(5),
        s.thirds[2].toFixed(5),
        1,
      ].join(",")
    )
    .join("\n");
  return `${header}${body}\n`;
}

function curvesBin(curves) {
  const buf = Buffer.alloc(curves.length * CURVE_POINTS * 2);
  curves.forEach((c, r) => c.forEach((v, i) => buf.writeInt16LE(v, r * CURVE_POINTS * 2 + i * 2)));
  return buf;
}

function eventsCsv(rows, cfg) {
  const start = rows[0].catchMs - 4200;
  const end = rows[rows.length - 1].catchMs + 2600;
  const lines = [
    [start - 1200, "session", "open"],
    [start - 900, "tare", "auto"],
    [rows[0].catchMs, "stroke", "first"],
    [Math.round((start + end) / 2), "battery", `${(4.02 - cfg.seat * 0.01).toFixed(2)}V`],
    [end, "session", "idle"],
  ];
  return `t_ms,type,detail\n${lines.map((l) => l.join(",")).join("\n")}\n`;
}

function metaJson(cfg, rows) {
  const elapsed = rows[rows.length - 1].catchMs + rows[rows.length - 1].driveMs + 2600 - (rows[0].catchMs - 5400);
  const start = rows[0].catchMs - 5400;
  return `${JSON.stringify(
    {
      format: 1,
      uuid: `d5f2${cfg.seat}a10-4c8e-4f1b-9a${cfg.seat}2-7c4e91b3f0${cfg.seat}8`,
      device_id: `RowTech-7A3F${(0x21 + cfg.seat).toString(16).toUpperCase()}`,
      seat: cfg.seat,
      fw: "v10.0.0",
      git: "demo",
      session: 42,
      open_reason: "stroke",
      start_ms: start,
      units: "kg",
      curve_points: CURVE_POINTS,
      curve_scale: CURVE_SCALE,
      sample_rate: 79.94,
      clock: "boot_ms",
      cal: {
        valid: true,
        points: 5,
        slope: 0.00043271 + cfg.seat * 1e-8,
        intercept: -12.4183,
        lin_err_pct: 0.42 + cfg.seat * 0.01,
        tare_offset: 128374 + cfg.seat * 91,
      },
      strokes: rows.length,
      dropped_samples: 3 + cfg.seat,
      end_ms: start + elapsed,
      elapsed_ms: elapsed,
      close_reason: "idle",
      closed: true,
    },
    null,
    2
  )}\n`;
}

await rm(OUT, { recursive: true, force: true });
for (const cfg of SEATS) {
  const { rows, curves } = buildSeat(cfg);
  const dir = path.join(OUT, `seat-${cfg.seat}`);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "meta.json"), metaJson(cfg, rows));
  await writeFile(path.join(dir, "strokes.csv"), strokesCsv(rows));
  await writeFile(path.join(dir, "curves.bin"), curvesBin(curves));
  await writeFile(path.join(dir, "events.csv"), eventsCsv(rows, cfg));
  console.log(`seat ${cfg.seat}: ${rows.length} strokes, ${curves.length * 128} bytes of curves`);
}

// A sketch of a river for the Vieve map illustration: a meandering centreline,
// banks either side, and a race line that takes the inside of each bend (the
// shortest line that stays in the stream). Pure and deterministic, so the
// server-rendered frame and the client's first frame match.
import { toPath } from "./stroke";

type Pt = [number, number];

const N = 360;
const HALF_WIDTH = 78;
const MAP_H = 2400;

function centre(s: number): Pt {
  return [
    500 + 210 * Math.sin(2 * Math.PI * 1.35 * s) + 70 * Math.sin(2 * Math.PI * 2.9 * s + 1.1),
    MAP_H - 100 - (MAP_H - 200) * s,
  ];
}

const C: Pt[] = Array.from({ length: N + 1 }, (_, i) => centre(i / N));

function normals(pts: Pt[]): Pt[] {
  return pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  });
}

const NC = normals(C);

// Signed curvature along the centreline, smoothed, then turned into an offset
// towards the inside of each bend and kept well inside the banks.
const curv = C.map((_, i) => {
  const a = C[Math.max(0, i - 2)];
  const b = C[i];
  const c = C[Math.min(N, i + 2)];
  const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1]) * Math.hypot(c[0] - a[0], c[1] - a[1]);
  return d ? (2 * cross) / d : 0;
});
const smooth = (xs: number[], r: number) =>
  xs.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let k = Math.max(0, i - r); k <= Math.min(xs.length - 1, i + r); k++) {
      s += xs[k];
      n++;
    }
    return s / n;
  });
const offset = smooth(
  smooth(curv, 14).map((k) => Math.max(-0.62, Math.min(0.62, k * 260)) * HALF_WIDTH),
  10
);

const RACE: Pt[] = C.map(([x, y], i) => [x - NC[i][0] * offset[i], y - NC[i][1] * offset[i]]);
const LEFT: Pt[] = C.map(([x, y], i) => [x + NC[i][0] * HALF_WIDTH, y + NC[i][1] * HALF_WIDTH]);
const RIGHT: Pt[] = C.map(([x, y], i) => [x - NC[i][0] * HALF_WIDTH, y - NC[i][1] * HALF_WIDTH]);

export const RIVER = {
  water: `${toPath(LEFT, 0.5)}L${toPath([...RIGHT].reverse(), 0.5).slice(1)}Z`,
  left: toPath(LEFT, 0.5),
  right: toPath(RIGHT, 0.5),
  race: toPath(RACE, 0.5),
  height: MAP_H,
};

// Arc length along the race line, for moving the boat at a steady speed.
const LEN: number[] = [0];
for (let i = 1; i < RACE.length; i++) LEN.push(LEN[i - 1] + Math.hypot(RACE[i][0] - RACE[i - 1][0], RACE[i][1] - RACE[i - 1][1]));
const TOTAL = LEN[LEN.length - 1];

/** Boat position and heading (degrees clockwise from map-up) at fraction p of the race line. */
export function boatAt(p: number): { x: number; y: number; heading: number } {
  const d = Math.min(TOTAL, Math.max(0, p * TOTAL));
  let i = 1;
  while (i < LEN.length - 1 && LEN[i] < d) i++;
  const k = (d - LEN[i - 1]) / (LEN[i] - LEN[i - 1] || 1);
  const [ax, ay] = RACE[i - 1];
  const [bx, by] = RACE[i];
  // Heading from a short look-ahead, so the map turns smoothly into bends.
  const j = Math.min(RACE.length - 1, i + 6);
  const h = Math.atan2(RACE[j][0] - ax, -(RACE[j][1] - ay));
  return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, heading: (h * 180) / Math.PI };
}

/** The map transform that puts the boat at (cx, cy) with its heading pointing up. */
export function headingUp(p: number, cx: number, cy: number) {
  const b = boatAt(p);
  return {
    transform: `translate(${cx} ${cy}) rotate(${(-b.heading).toFixed(2)}) translate(${(-b.x).toFixed(1)} ${(-b.y).toFixed(1)})`,
    heading: b.heading,
  };
}

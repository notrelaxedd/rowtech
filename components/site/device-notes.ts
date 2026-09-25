import type { Note3D } from "@/components/device3d/types";

// What each note around the 3D models points at. Model units are the concept
// drawings' px / 10, centred on the body (force-device.tsx: 1180 x 800, body
// 24,24 1020x740, screen window 86,90 702x468; vieve-device.tsx: 1320 x 760,
// body 20,20 1280x700, screen window 92,130 740x444). Only confirmed facts go
// in the notes.

type P = [number, number, number];

const rect = (x0: number, y0: number, x1: number, y1: number, z: number): P[] => [
  [x0, y0, z],
  [x1, y0, z],
  [x1, y1, z],
  [x0, y1, z],
  [x0, y0, z],
];
const ring = (cx: number, cy: number, r: number, z: number): P[] =>
  Array.from({ length: 41 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z] as P;
  });

// Force: screen top-left at (-44.8, 30.4), 0.14625 units per screen px.
const FZ = 13.5;
const fs = (px: number, py: number): [number, number] => [-44.8 + px * 0.14625, 30.4 - py * 0.14625];

export const FORCE_DEFAULT_VIEW: [number, number] = [-0.32, 0.16];

export const FORCE_NOTES: readonly Note3D[] = [
  {
    id: "seat",
    label: "Seat number",
    body: "Which seat the node is on, set on the node’s own web page, counting bow as 1.",
    anchor: [...fs(128, 17), FZ],
    side: "left",
    view: [0.12, 0.08],
    outline: rect(...fs(0, 0), ...fs(120, 34), FZ + 0.2),
  },
  {
    id: "peak",
    label: "Peak force",
    body: "The stroke’s peak. It reads in raw sensor units until the node is calibrated.",
    anchor: [...fs(190, 58), FZ],
    side: "left",
    view: [0.12, 0.05],
    outline: rect(...fs(0, 34), ...fs(214, 254), FZ + 0.2),
  },
  {
    id: "screen",
    label: "Screen",
    body: "3.5″, 480×320 TFT.",
    anchor: [-46.6, -8, FZ],
    side: "left",
    view: [0.1, 0.05],
    outline: rect(...fs(0, 0), ...fs(480, 320), FZ + 0.2),
  },
  {
    id: "inside",
    label: "Inside the case",
    body: "An Adafruit Feather ESP32-S3 and an HX711 breakout on a RowTech carrier board, a microSD card for every session, and a 3000 mAh battery. The node runs its own Wi-Fi network.",
    anchor: [0, 37, 0],
    side: "right",
    view: [-0.2, 0.5],
    outline: rect(-51, 37.2, 51, 37.2, 0).map(([x, , ], i) => [x, 37.2, i < 2 || i === 4 ? 13 : -13] as P),
  },
  {
    id: "curve",
    label: "Force curve",
    body: "This stroke’s force curve, drawn through the drive as the rower pulls.",
    anchor: [...fs(420, 90), FZ],
    side: "right",
    view: [-0.08, 0.05],
    outline: rect(...fs(214, 34), ...fs(480, 254), FZ + 0.2),
  },
  {
    id: "view",
    label: "VIEW",
    body: "Steps through the rower’s screens: live, this stroke, and the session so far.",
    anchor: [36.6, 2.2, 14.2],
    side: "right",
    view: [-0.45, 0.1],
    outline: ring(36.6, 2.2, 6.3, 14.3),
  },
  {
    id: "tare",
    label: "TARE",
    body: "Hold it to zero the load cell before you push off.",
    anchor: [36.6, -10.2, 14.2],
    side: "right",
    view: [-0.45, 0.1],
    outline: ring(36.6, -10.2, 6.3, 14.3),
  },
  {
    id: "power",
    label: "POWER",
    body: "Hold it to switch the node on or off.",
    anchor: [36.6, -22.6, 14.2],
    side: "right",
    view: [-0.45, 0.1],
    outline: ring(36.6, -22.6, 6.3, 14.3),
  },
];

// Vieve: screen top-left at (-56.8, 24), 0.0925 units per screen px.
const VZ = 11.5;
const vs = (px: number, py: number): [number, number] => [-56.8 + px * 0.0925, 24 - py * 0.0925];

export const VIEVE_DEFAULT_VIEW: [number, number] = [-0.3, 0.14];

export const VIEVE_NOTES: readonly Note3D[] = [
  {
    id: "screen",
    label: "Screen",
    body: "Planned: 5″, 1000 nits.",
    anchor: [-61.2, -6, VZ],
    side: "left",
    view: [0.12, 0.05],
    outline: rect(...vs(0, 0), ...vs(800, 480), VZ + 0.2),
  },
  {
    id: "inside",
    label: "Inside the case",
    body: "Planned: a u-blox MAX-M10S GPS at 10 Hz and a 5000 mAh battery. Vieve will carry the cox’s voice out to the boat’s speakers, link to every seat node by radio, stamp each session with GPS time, and upload the outing over Wi-Fi once you’re ashore.",
    anchor: [0, 35, 0],
    side: "right",
    view: [-0.2, 0.5],
    outline: rect(-64, 35.2, 64, 35.2, 0).map(([x], i) => [x, 35.2, i < 2 || i === 4 ? 11 : -11] as P),
  },
  {
    id: "map",
    label: "Map",
    body: "A GPS map on the cox’s screen.",
    anchor: [...vs(414, 240), VZ],
    side: "right",
    view: [-0.1, 0.05],
    outline: rect(...vs(312, 38), ...vs(516, 438), VZ + 0.2),
  },
];

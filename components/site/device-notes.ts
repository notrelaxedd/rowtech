import type { Annotation } from "./annotated-diagram";

// What each numbered marker on the device drawings points at. Positions are
// in % of each drawing, taken from its own geometry (force-device.tsx:
// 1180 x 800, screen window 86,90 702x468; vieve-device.tsx: 1320 x 760,
// screen window 92,130 740x444). Only confirmed facts go in the notes.

const f = (x: number, y: number) => ({ x: (x / 1180) * 100, y: (y / 800) * 100 });
const fr = (x: number, y: number, w: number, h: number, round = false) => ({
  x: (x / 1180) * 100,
  y: (y / 800) * 100,
  w: (w / 1180) * 100,
  h: (h / 800) * 100,
  round,
});

export const FORCE_RATIO = 1180 / 800;

export const FORCE_NOTES: readonly Annotation[] = [
  {
    id: "seat",
    label: "Seat number",
    body: "Which seat the node is on, set on the node’s own web page, counting bow as 1.",
    at: f(262, 115),
    region: fr(86, 90, 176, 50),
  },
  {
    id: "peak",
    label: "Peak force",
    body: "The stroke’s peak. It reads in raw sensor units until the node is calibrated.",
    at: f(380, 160),
    region: fr(86, 140, 313, 321),
  },
  {
    id: "curve",
    label: "Force curve",
    body: "This stroke’s force curve, drawn through the drive as the rower pulls.",
    at: f(770, 160),
    region: fr(399, 140, 389, 321),
  },
  {
    id: "screen",
    label: "Screen",
    body: "3.5″, 480×320 TFT.",
    at: f(58, 330),
    region: fr(86, 90, 702, 468),
  },
  {
    id: "view",
    label: "VIEW",
    body: "Steps through the rower’s screens: live, this stroke, and the session so far.",
    at: f(822, 372),
    region: fr(848, 320, 104, 104, true),
  },
  {
    id: "tare",
    label: "TARE",
    body: "Hold it to zero the load cell before you push off.",
    at: f(822, 496),
    region: fr(848, 444, 104, 104, true),
  },
  {
    id: "inside",
    label: "Inside the case",
    body: "An Adafruit Feather ESP32-S3 and an HX711 breakout on a RowTech carrier board, a microSD card for every session, and a 3000 mAh battery. The node runs its own WiFi network.",
    at: f(560, 690),
    region: fr(24, 24, 1020, 740),
  },
];

const v = (x: number, y: number) => ({ x: (x / 1320) * 100, y: (y / 760) * 100 });
const vr = (x: number, y: number, w: number, h: number) => ({
  x: (x / 1320) * 100,
  y: (y / 760) * 100,
  w: (w / 1320) * 100,
  h: (h / 760) * 100,
});

export const VIEVE_RATIO = 1320 / 760;

export const VIEVE_NOTES: readonly Annotation[] = [
  {
    id: "screen",
    label: "Screen",
    body: "5″, rated at 1000 nits.",
    at: v(62, 352),
    region: vr(92, 130, 740, 444),
  },
  {
    id: "map",
    label: "Map",
    body: "A GPS map on the cox’s screen.",
    at: v(475, 186),
    region: vr(380, 165, 189, 370),
  },
  {
    id: "inside",
    label: "Inside the case",
    body: "A u-blox MAX-M10S GPS at 10 Hz and a 5000 mAh battery. Vieve will carry the cox’s voice out to the boat’s speakers, link to every seat node by radio, stamp each session with GPS time, and upload the outing over WiFi once you’re ashore.",
    at: v(600, 660),
    region: vr(20, 20, 1280, 700),
  },
];

// Product specifications. Only confirmed facts: see the claims review in the
// site refinement PR before adding a row.
export type Spec = readonly [label: string, value: string];

export const FORCE_SPECS: readonly Spec[] = [
  ["Load cell", "50 kg, in series on the rigger backstay"],
  ["Fits", "[OWNER: which riggers and boats it fits, and which riggers it doesn’t fit: rigger types, stay diameter range, sweep/scull, tested boats]"],
  ["Electronics", "Adafruit Feather ESP32-S3 and an HX711 breakout on a RowTech carrier board, sampling at 80 Hz"],
  ["Catch timing", "Interpolated between samples 12.5 ms apart, to a resolution of about 3 ms"],
  ["Calibration", "Up to 5 points against known weights; reports its own worst-case error; not yet run on a node"],
  ["Doesn’t measure", "[OWNER: confirm what Force doesn’t measure, e.g. oar angle, power, boat speed, and why it measures at the backstay instead of the oarlock (the trade-off)]"],
  ["Screen", "3.5″, 480×320 TFT"],
  ["Keys", "VIEW, TARE, POWER"],
  ["Seat number", "Set on the node’s own web page"],
  ["Network", "Its own Wi-Fi network; download from a phone or laptop"],
  ["Storage", "microSD, with strokes.csv, curves.bin, events.csv and meta.json for each session"],
  ["Battery", "3000 mAh"],
  ["Target price", "[OWNER: Force target price per seat]"],
];

export const VIEVE_SPECS: readonly Spec[] = [
  ["Screen", "Planned: 5″, 1000 nits"],
  ["GPS", "Planned: u-blox MAX-M10S, 10 Hz"],
  ["Crew link", "Radio to every seat node; target of every seat within 5 ms"],
  ["Battery", "Planned: 5000 mAh"],
  ["Target price", "$499"],
];

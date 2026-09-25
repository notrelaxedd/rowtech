// Product specifications. Only confirmed facts: see the claims review in the
// site refinement PR before adding a row.
export type Spec = readonly [label: string, value: string];

export const FORCE_SPECS: readonly Spec[] = [
  ["Load cell", "50 kg, in series on the rigger backstay"],
  ["Electronics", "Adafruit Feather ESP32-S3 and an HX711 breakout on a RowTech carrier board, 80 samples a second"],
  ["Catch timing", "Interpolated between samples 12.5 ms apart, to a resolution of about 3 ms"],
  ["Calibration", "Up to 5 points against known weights; reports its own worst-case error. Not yet run on a node"],
  ["Screen", "3.5″ 480×320 TFT"],
  ["Keys", "VIEW, TARE, POWER"],
  ["Seat number", "Set on the node’s own web page"],
  ["Network", "Its own WiFi network; download from a phone or laptop"],
  ["Storage", "microSD. Per session: strokes.csv, curves.bin, events.csv, meta.json"],
  ["Battery", "3000 mAh"],
];

export const VIEVE_SPECS: readonly Spec[] = [
  ["Screen", "Planned: 5″, 1000 nits"],
  ["GPS", "Planned: u-blox MAX-M10S, 10 Hz"],
  ["Crew link", "Radio to every seat node; target of every seat within 5 ms"],
  ["Battery", "Planned: 5000 mAh"],
  ["Target price", "$499"],
];

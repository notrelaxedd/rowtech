import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { zipSync } from "fflate";
import { parseSession, parseStrokes, parseMeta, curveAt } from "../lib/session/parse";
import { SessionFormatError, CURVE_BYTES, CURVE_POINTS } from "../lib/session/format";
import { collectSessions, ZIP_LIMITS, ZipTooLargeError } from "../lib/session/collect";
import { summarise, toCsv } from "../lib/session/analyse";

const seatDir = (n: number) => path.join(process.cwd(), "public", "demo", `seat-${n}`);
const read = (n: number, f: string) => readFile(path.join(seatDir(n), f));

async function bundle(n: number) {
  const [meta, strokes, curves, events] = await Promise.all([
    read(n, "meta.json"),
    read(n, "strokes.csv"),
    read(n, "curves.bin"),
    read(n, "events.csv"),
  ]);
  return { meta, strokes, curves: new Uint8Array(curves), events };
}

test("a node session parses into the numbers the firmware wrote", async () => {
  const b = await bundle(1);
  const session = parseSession({
    meta: b.meta.toString(),
    strokes: b.strokes.toString(),
    events: b.events.toString(),
    curves: b.curves,
  });

  expect(session.meta.format).toBe(1);
  expect(session.meta.seat).toBe(1);
  expect(session.meta.curvePoints).toBe(CURVE_POINTS);
  expect(session.strokes).toHaveLength(147);
  expect(session.curves?.byteLength).toBe(147 * CURVE_BYTES);

  // Record N's curve sits at N * 128, and peaks at 1.0 of its own peak.
  const curve = curveAt(session.curves!, 10);
  expect(curve).not.toBeNull();
  expect(Math.max(...curve!)).toBeGreaterThan(0.98);
  expect(Math.max(...curve!)).toBeLessThanOrEqual(1.0001);

  // The summary is arithmetic on those rows, nothing more.
  const summary = summarise(session.strokes);
  expect(summary.strokes).toBe(147);
  expect(summary.avgRate).toBeGreaterThan(20);
  expect(summary.avgRate).toBeLessThan(40);
  expect(summary.consistencyPct).not.toBeNull();
});

test("export gives back the same rows", async () => {
  const b = await bundle(3);
  const strokes = parseStrokes(b.strokes.toString());
  const again = parseStrokes(toCsv(strokes));
  expect(again).toEqual(strokes);
});

test("a file that isn't this format is refused, with a reason", async () => {
  const b = await bundle(1);

  expect(() => parseStrokes("rec,seq,catch_ms\n1,2,3\n")).toThrow(SessionFormatError);
  expect(() => parseStrokes(b.strokes.toString().replace("rec,seq", "REC,seq"))).toThrow(/header/i);

  const future = b.meta.toString().replace('"format": 1', '"format": 2');
  expect(() => parseMeta(future)).toThrow(/format 2/);

  // Values the dashboard's tables can't hold are refused before anything is saved.
  expect(() => parseMeta(b.meta.toString().replace('"seat": 1', '"seat": 9'))).toThrow(/seat should be a whole number from 0 to 8/);
  expect(() => parseMeta(b.meta.toString().replace('"units": "kg"', `"units": "${"k".repeat(13)}"`))).toThrow(/units is longer/);
  const lines = b.strokes.toString().split("\n");
  const withRow = (row: string) => [lines[0], row].join("\n");
  expect(() => parseStrokes(withRow("0,1,42065,99999999999,1337,56.6,37,28.0,219.7,9.2,13.3,5.5,1"))).toThrow(/line 2: drive_ms/);
  expect(() => parseStrokes(withRow("0,1,42065,777,1337,56.6,101,28.0,219.7,9.2,13.3,5.5,1"))).toThrow(/line 2: peak_pos_pct/);
  expect(() => parseStrokes(withRow("0,1,42065,777,1337,1e39,37,28.0,219.7,9.2,13.3,5.5,1"))).toThrow(/line 2: peak is out of range/);
  expect(parseStrokes(withRow(lines[1]))).toHaveLength(1);

  // Curves that don't line up with the strokes are a mismatched pair.
  expect(() =>
    parseSession({ meta: b.meta.toString(), strokes: b.strokes.toString(), curves: b.curves.slice(0, 500) })
  ).toThrow(/whole number of 128-byte records/);
});

test("an upload groups seats, loose files and zips the same way", async () => {
  const one = await bundle(2);
  const two = await bundle(6);

  // Loose files from one folder: one session.
  const loose = collectSessions([
    { name: "meta.json", bytes: new Uint8Array(one.meta) },
    { name: "strokes.csv", bytes: new Uint8Array(one.strokes) },
    { name: "curves.bin", bytes: one.curves },
  ]);
  expect(loose.size).toBe(1);

  // A zip of two seats: two sessions, kept apart by their folders.
  const zip = zipSync({
    "outing/seat-2/meta.json": new Uint8Array(one.meta),
    "outing/seat-2/strokes.csv": new Uint8Array(one.strokes),
    "outing/seat-2/curves.bin": one.curves,
    "outing/seat-6/meta.json": new Uint8Array(two.meta),
    "outing/seat-6/strokes.csv": new Uint8Array(two.strokes),
    "outing/seat-6/curves.bin": two.curves,
    "outing/readme.txt": new TextEncoder().encode("ignored"),
  });
  const zipped = collectSessions([{ name: "session.zip", bytes: zip }]);
  expect(zipped.size).toBe(2);
  for (const folder of zipped.values()) {
    expect(folder.meta).toBeTruthy();
    expect(folder.strokes).toBeTruthy();
  }

  // A folder with no session in it is dropped rather than half-read.
  expect(collectSessions([{ name: "notes/readme.txt", bytes: new Uint8Array([1]) }]).size).toBe(0);
});

test("a zip that would expand past what an upload needs is refused before it is inflated", () => {
  // A few kB that expands to more than any session file can be.
  const bomb = zipSync({ "s/strokes.csv": new Uint8Array(ZIP_LIMITS.fileBytes + 1), "s/meta.json": new Uint8Array(1) });
  expect(bomb.byteLength).toBeLessThan(64 * 1024);
  expect(() => collectSessions([{ name: "bomb.zip", bytes: bomb }])).toThrow(ZipTooLargeError);

  // Too many session files, however small.
  const many: Record<string, Uint8Array> = {};
  for (let i = 0; i <= ZIP_LIMITS.files; i++) many[`s${i}/meta.json`] = new Uint8Array(1);
  expect(() => collectSessions([{ name: "many.zip", bytes: zipSync(many) }])).toThrow(ZipTooLargeError);

  // Anything that isn't a session file doesn't count, and isn't expanded.
  const junk = zipSync({ "photos/big.jpg": new Uint8Array(ZIP_LIMITS.totalBytes + 1), "s/notes.txt": new Uint8Array(10) });
  expect(collectSessions([{ name: "junk.zip", bytes: junk }]).size).toBe(0);
});

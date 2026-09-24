import { test, expect } from "@playwright/test";
import { gridTicks, niceStep } from "../lib/chart";

test("the curve's grid is a handful of round lines, in kg or raw counts", () => {
  expect(niceStep(13.44)).toBe(20);
  expect(niceStep(0.224)).toBe(0.5);
  expect(niceStep(107_520)).toBe(200_000);
  expect(niceStep(5)).toBe(5);

  // 60 kg peaks draw the lines they always did.
  expect(gridTicks(60 * 1.12)).toEqual([0, 20, 40, 60]);
  expect(gridTicks(1.12)).toEqual([0, 0.5, 1]);
  expect(gridTicks(8)).toEqual([0, 2, 4, 6, 8]);
  // An uncalibrated node's counts: a few lines, not one every 20 counts.
  expect(gridTicks(480_000 * 1.12)).toEqual([0, 200_000, 400_000]);
  for (const top of [1.12, 3.3, 9.9, 67.2, 1234, 56_789, 537_600, 12_345_678]) {
    const ticks = gridTicks(top);
    expect(ticks.length, `${top}`).toBeGreaterThanOrEqual(3);
    expect(ticks.length, `${top}`).toBeLessThanOrEqual(6);
    expect(ticks[ticks.length - 1], `${top}`).toBeLessThanOrEqual(top);
  }
  // Labels come out round, not 0.30000000000000004.
  expect(gridTicks(0.35, 5)).toEqual([0, 0.1, 0.2, 0.3]);
  // Nothing to scale: one line, and no endless loop.
  expect(gridTicks(Infinity)).toEqual([0]);
  expect(gridTicks(NaN)).toEqual([0]);
});

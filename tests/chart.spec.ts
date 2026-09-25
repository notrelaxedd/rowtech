import { test, expect } from "@playwright/test";
import { gridTicks, niceStep, paddedRange } from "../lib/chart";
import { impulseCv, measureStroke, recentStrokes } from "../lib/stroke";

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

test("a chart's value axis is never upside down, and negative data isn't cut off at 0", () => {
  // Every value the same negative number: room either side of it.
  const flatNegative = paddedRange(-40, -40, 0.2);
  expect(flatNegative.top).toBeGreaterThan(-40);
  expect(flatNegative.bottom).toBeLessThan(-40);

  const negative = paddedRange(-50, -10, 0.2);
  expect(negative).toEqual({ bottom: -58, top: -2 });
  const mixed = paddedRange(-5, 15, 0.15);
  expect(mixed.bottom).toBeCloseTo(-8);
  expect(mixed.top).toBeCloseTo(18);

  // Positive data keeps a tight baseline, stopping at 0.
  expect(paddedRange(50, 60, 0.2)).toEqual({ bottom: 48, top: 62 });
  expect(paddedRange(50, 50, 0.2)).toEqual({ bottom: 40, top: 60 });
  expect(paddedRange(2, 60, 0.2).bottom).toBe(0);
  expect(paddedRange(0, 0, 0.2)).toEqual({ bottom: 0, top: 0.2 });
});

// The home page's stroke chart prints what the model measures, not constants
// typed in beside it (CNT-018).
test("the stroke chart's figures are the ones measured from its curve", async ({ page }) => {
  const m = measureStroke();
  expect(Math.round(m.driveMs)).toBe(782);
  await page.goto("/");
  const chart = page.locator("#stroke");
  await expect(chart).toContainText(`${m.rise.toFixed(0)} kg/s`);
  await expect(chart).toContainText(`${m.peakKg.toFixed(1)} kg at ${m.peakPct.toFixed(0)}%`);
  await expect(chart).toContainText(`CV ${impulseCv(recentStrokes()).toFixed(1)}%`);
});

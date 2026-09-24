"use client";

import { useEffect, useRef } from "react";
import { CURVE_POINTS } from "@/lib/session/format";
import { gridTicks } from "@/lib/chart";
import type { StrokeRow } from "@/lib/session/format";

export type CurveLayer = {
  /** 0..1 of the stroke's own peak, straight out of curves.bin. */
  curve: Float32Array | null;
  stroke: StrokeRow;
  colour: string;
  label: string;
  /** The reference layer gets the markers and the thirds shading. */
  main?: boolean;
};

const PAD = { l: 52, r: 16, t: 16, b: 30 };

/**
 * One stroke's force curve, on canvas: catch to release, in the session's own
 * units. The curve is 64 points of the drive, so the x axis is the drive and
 * the release is the last point -- which is exactly what the node recorded.
 */
export function CurveCanvas({
  layers,
  height = 320,
  loadFailed = false,
}: {
  layers: CurveLayer[];
  height?: number;
  /** The seat's curves file is there but didn't load. */
  loadFailed?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const draw = () => {
      const w = parent.clientWidth;
      const h = height;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const c = canvas.getContext("2d");
      if (!c) return;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);

      const peaks = layers.map((l) => l.stroke.peak);
      const top = Math.max(1, ...peaks) * 1.12;
      // A handful of round grid lines, kg or raw counts, and a left margin
      // wide enough for the longest label.
      c.font = "11px ui-monospace, monospace";
      const ticks = gridTicks(top);
      const left = Math.max(PAD.l, ...ticks.map((v) => Math.ceil(c.measureText(String(v)).width) + 16));
      const plotW = w - left - PAD.r;
      const plotH = h - PAD.t - PAD.b;
      const drives = layers.map((l) => l.stroke.driveMs);
      const span = Math.max(1, ...drives);
      const X = (ms: number) => left + (ms / span) * plotW;
      const Y = (v: number) => PAD.t + plotH - (v / top) * plotH;

      // grid
      c.strokeStyle = "rgba(255,255,255,0.07)";
      c.fillStyle = "#8d9aa6";
      c.lineWidth = 1;
      for (const v of ticks) {
        const y = Math.round(Y(v)) + 0.5;
        c.beginPath();
        c.moveTo(left, y);
        c.lineTo(w - PAD.r, y);
        c.stroke();
        c.textAlign = "right";
        c.fillText(String(v), left - 8, y + 4);
      }
      for (let f = 0; f <= 1.0001; f += 0.25) {
        const x = Math.round(X(span * f)) + 0.5;
        c.beginPath();
        c.moveTo(x, PAD.t);
        c.lineTo(x, PAD.t + plotH);
        c.stroke();
        c.textAlign = "center";
        c.fillText(f === 0 ? "catch" : `${Math.round(span * f)} ms`, x, h - 10);
      }

      const main = layers.find((l) => l.main) ?? layers[0];

      // work by thirds, behind everything
      if (main?.curve) {
        const third = main.stroke.driveMs / 3;
        for (let i = 0; i < 3; i++) {
          c.fillStyle = i === 1 ? "rgba(34,227,239,0.10)" : "rgba(34,227,239,0.05)";
          c.fillRect(X(i * third), PAD.t, X(third) - left, plotH);
        }
      }

      for (const layer of layers) {
        if (!layer.curve) continue;
        const { curve, stroke } = layer;
        c.beginPath();
        for (let i = 0; i < CURVE_POINTS; i++) {
          const x = X((stroke.driveMs * i) / (CURVE_POINTS - 1));
          const y = Y(curve[i] * stroke.peak);
          if (i === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.strokeStyle = layer.colour;
        c.lineWidth = layer.main ? 2.25 : 1.5;
        c.globalAlpha = layer.main ? 1 : 0.75;
        c.lineJoin = "round";
        c.stroke();
        c.globalAlpha = 1;
      }

      // catch, peak and release on the reference stroke
      if (main?.curve) {
        const { curve, stroke } = main;
        let pi = 0;
        for (let i = 1; i < CURVE_POINTS; i++) if (curve[i] > curve[pi]) pi = i;
        const marks: Array<[number, number, string, string]> = [
          [X(0), Y(curve[0] * stroke.peak), "catch", "#ffa630"],
          [X((stroke.driveMs * pi) / (CURVE_POINTS - 1)), Y(curve[pi] * stroke.peak), "peak", "#ffa630"],
          [X(stroke.driveMs), Y(curve[CURVE_POINTS - 1] * stroke.peak), "release", "#ffa630"],
        ];
        c.font = "11px ui-monospace, monospace";
        for (const [x, y, text, colour] of marks) {
          c.beginPath();
          c.arc(x, y, 4, 0, Math.PI * 2);
          c.fillStyle = "#07090b";
          c.fill();
          c.strokeStyle = colour;
          c.lineWidth = 2;
          c.stroke();
          c.fillStyle = colour;
          c.textAlign = text === "release" ? "right" : text === "catch" ? "left" : "center";
          c.fillText(text, x, Math.max(PAD.t + 10, y - 10));
        }
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [layers, height]);

  const main = layers.find((l) => l.main) ?? layers[0];
  return (
    <div className="relative w-full">
      <canvas
        ref={ref}
        role="img"
        aria-label={
          main
            ? `Force curve for stroke ${main.stroke.rec + 1}: peak ${main.stroke.peak.toFixed(1)} at ${main.stroke.peakPosPct}% of a ${main.stroke.driveMs} millisecond drive.`
            : "No force curve for this stroke."
        }
      />
      {!main?.curve && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {loadFailed
            ? "Couldn’t load the curve. Reload the page to try again."
            : "The node didn’t keep a curve for this stroke."}
        </p>
      )}
    </div>
  );
}

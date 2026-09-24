"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { SessionStats } from "@/lib/supabase/types";

/** A seat session's row of session_stats: one with a seat. */
export type HistoryPoint = Pick<
  SessionStats,
  "session_id" | "recorded_at" | "avg_peak" | "avg_rise_rate" | "avg_peak_pos_pct" | "avg_drive_ms" | "avg_recovery_ms" | "consistency_pct" | "strokes"
> & { seat_number: number };

const SERIES = [
  { id: "avg_peak", label: "Peak", get: (p: HistoryPoint) => p.avg_peak },
  { id: "avg_rise_rate", label: "Rise rate", get: (p: HistoryPoint) => p.avg_rise_rate },
  { id: "avg_peak_pos_pct", label: "Peak position", get: (p: HistoryPoint) => p.avg_peak_pos_pct },
  { id: "ratio", label: "Drive : recovery", get: (p: HistoryPoint) => (p.avg_drive_ms ? (p.avg_recovery_ms ?? 0) / p.avg_drive_ms : null) },
  { id: "consistency_pct", label: "Consistency", get: (p: HistoryPoint) => p.consistency_pct },
] as const;

const COLOURS = ["#22e3ef", "#3ddc6e", "#ffa630", "#a78bfa", "#f472b6", "#60a5fa", "#fbbf24", "#94a3b8"];

/** One metric, per seat, across sessions. Canvas: a season is a lot of points. */
export function HistoryPanel({ points }: { points: HistoryPoint[] }) {
  const [seriesId, setSeriesId] = useState<(typeof SERIES)[number]["id"]>("avg_peak");
  const ref = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const series = SERIES.find((s) => s.id === seriesId) ?? SERIES[0];

  const seats = [...new Set(points.map((p) => p.seat_number))].sort((a, b) => a - b);

  useEffect(() => {
    const canvas = ref.current;
    const parent = box.current;
    if (!canvas || !parent) return;
    const draw = () => {
      const w = parent.clientWidth;
      const h = 260;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const c = canvas.getContext("2d");
      if (!c) return;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);

      const pad = { l: 48, r: 12, t: 12, b: 26 };
      const values = points.map(series.get).filter((v): v is number => v !== null);
      if (!values.length) return;
      const hi = Math.max(...values);
      const lo = Math.min(...values);
      const padV = (hi - lo || hi || 1) * 0.2;
      const top = hi + padV;
      const bottom = Math.max(0, lo - padV);
      const times = points.map((p) => new Date(p.recorded_at).getTime());
      const t0 = Math.min(...times);
      const t1 = Math.max(...times);
      const X = (t: number) => pad.l + (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)) * (w - pad.l - pad.r);
      const Y = (v: number) => pad.t + (1 - (v - bottom) / (top - bottom || 1)) * (h - pad.t - pad.b);

      c.strokeStyle = "rgba(255,255,255,0.07)";
      c.fillStyle = "#8d9aa6";
      c.font = "11px ui-monospace, monospace";
      c.textAlign = "right";
      for (let i = 0; i <= 4; i++) {
        const v = bottom + ((top - bottom) * i) / 4;
        const y = Math.round(Y(v)) + 0.5;
        c.beginPath();
        c.moveTo(pad.l, y);
        c.lineTo(w - pad.r, y);
        c.stroke();
        c.fillText(v.toFixed(v > 50 ? 0 : 1), pad.l - 8, y + 4);
      }

      seats.forEach((seat, i) => {
        const mine = points.filter((p) => p.seat_number === seat).sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
        c.strokeStyle = COLOURS[i % COLOURS.length];
        c.fillStyle = COLOURS[i % COLOURS.length];
        c.lineWidth = 1.75;
        c.beginPath();
        let started = false;
        for (const p of mine) {
          const v = series.get(p);
          if (v === null) continue;
          const x = X(new Date(p.recorded_at).getTime());
          const y = Y(v);
          if (started) c.lineTo(x, y);
          else {
            c.moveTo(x, y);
            started = true;
          }
        }
        c.stroke();
        for (const p of mine) {
          const v = series.get(p);
          if (v === null) continue;
          c.beginPath();
          c.arc(X(new Date(p.recorded_at).getTime()), Y(v), 3, 0, Math.PI * 2);
          c.fill();
        }
      });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [points, series, seats]);

  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <div className="flex flex-wrap items-center gap-2 pb-3">
        {SERIES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === seriesId}
            onClick={() => setSeriesId(s.id)}
            className={cn(
              "min-h-9 rounded-md border border-line px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace",
              s.id === seriesId ? "border-trace/60 bg-trace/10 text-trace" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}
        <ul className="ml-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
          {seats.map((seat, i) => (
            <li key={seat} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: COLOURS[i % COLOURS.length] }} />
              seat {seat}
            </li>
          ))}
        </ul>
      </div>
      <div ref={box}>
        <canvas ref={ref} role="img" aria-label={`${series.label} by seat, across ${points.length} sessions.`} className="block" />
      </div>
    </div>
  );
}

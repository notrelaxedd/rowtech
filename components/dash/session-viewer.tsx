"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { curveAt } from "@/lib/session/parse";
import type { StrokeRow } from "@/lib/session/format";
import { METRICS, duration, fmt, rateAt, summarise, thirdsPct, toCsv, type MetricId } from "@/lib/session/analyse";
import { CurveCanvas, type CurveLayer } from "./curve-canvas";
import { StrokeList, StrokeTimeline } from "./stroke-timeline";
import { cn } from "@/lib/utils";
import { picker } from "@/components/ui/field";
import { chip } from "./chip";

/** One node session: its strokes, and where to fetch its curves.bin. */
export type SeatSource = {
  id: string;
  /** null when the node's seat was never set. */
  seat: number | null;
  label: string;
  units: string;
  strokes: StrokeRow[];
  curvesUrl: string | null;
};

export function SessionViewer({ seats, title }: { seats: SeatSource[]; title?: string }) {
  const [seatId, setSeatId] = useState(seats[0]?.id ?? "");
  const [selected, setSelected] = useState(0);
  const [compare, setCompare] = useState<number | null>(null);
  const [overlaySeat, setOverlaySeat] = useState<string | null>(null);
  const [metricId, setMetricId] = useState<MetricId>("peak");
  // A seat's curves.bin, or "failed" when the fetch didn't come back (a signed
  // link past its hour, or the network): not the same as a seat with no file.
  const [curves, setCurves] = useState<Record<string, Uint8Array | "failed">>({});
  const pending = useRef(new Set<string>());

  const seat = seats.find((s) => s.id === seatId) ?? seats[0];
  const other = overlaySeat ? (seats.find((s) => s.id === overlaySeat) ?? null) : null;

  // curves.bin is fetched once per seat, on demand: 128 bytes a stroke.
  useEffect(() => {
    for (const s of [seat, other]) {
      if (!s?.curvesUrl || s.id in curves || pending.current.has(s.id)) continue;
      pending.current.add(s.id);
      fetch(s.curvesUrl)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => setCurves((c) => ({ ...c, [s.id]: new Uint8Array(b) })))
        .catch(() => {
          pending.current.delete(s.id);
          setCurves((c) => ({ ...c, [s.id]: "failed" }));
        });
    }
  }, [seat, other, curves]);

  // Picking a seat whose curves didn't load tries them again.
  const retry = (id: string) =>
    setCurves((c) => {
      if (c[id] !== "failed") return c;
      const rest = { ...c };
      delete rest[id];
      return rest;
    });

  const strokes = useMemo(() => seat?.strokes ?? [], [seat]);
  const summary = useMemo(() => summarise(strokes), [strokes]);
  const current = strokes[Math.min(selected, strokes.length - 1)];

  if (!seat || !current) {
    return <p className="text-sm text-muted-foreground">This session has no strokes in it.</p>;
  }

  const loaded = curves[seat.id];
  const bytes = loaded instanceof Uint8Array ? loaded : null;
  const layers: CurveLayer[] = [
    { curve: bytes ? curveAt(bytes, current.rec) : null, stroke: current, colour: "#22e3ef", label: `Stroke ${selected + 1}`, main: true },
  ];
  if (compare !== null && strokes[compare]) {
    layers.push({
      curve: bytes ? curveAt(bytes, strokes[compare].rec) : null,
      stroke: strokes[compare],
      colour: "#ffa630",
      label: `Stroke ${compare + 1}`,
    });
  }
  if (other) {
    const otherLoaded = curves[other.id];
    const otherBytes = otherLoaded instanceof Uint8Array ? otherLoaded : null;
    const same = other.strokes[selected];
    if (same) {
      layers.push({
        curve: otherBytes ? curveAt(otherBytes, same.rec) : null,
        stroke: same,
        colour: "#3ddc6e",
        label: `${other.label}, stroke ${selected + 1}`,
      });
    }
  }

  const rate = rateAt(strokes, selected);
  const thirds = thirdsPct(current);
  const u = seat.units === "counts" ? " counts" : ` ${seat.units}`;

  const download = () => {
    const blob = new Blob([toCsv(strokes)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title ? title.replace(/\W+/g, "-").toLowerCase() : "session"}${seat.seat === null ? "" : `-seat-${seat.seat}`}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      {/* summary strip */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["Strokes", String(summary.strokes)],
          ["Duration", duration(summary.durationMs)],
          ["Avg rate", summary.avgRate ? `${fmt(summary.avgRate)} spm` : "—"],
          ["Avg peak", `${fmt(summary.avgPeak)}${u}`],
          ["Consistency", summary.consistencyPct === null ? "—" : `CV ${fmt(summary.consistencyPct)}%`],
        ].map(([k, v]) => (
          <div key={k} className="bg-panel px-4 py-3">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="readout mt-1 text-xl text-foreground">{v}</dd>
          </div>
        ))}
      </dl>

      {/* seats */}
      {seats.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Seat</span>
          {seats.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === seat.id}
              onClick={() => {
                setSeatId(s.id);
                retry(s.id);
              }}
              className={cn(chip, "readout", s.id === seat.id ? "border-trace/60 bg-trace/10 text-trace" : "text-muted-foreground hover:text-foreground")}
            >
              {s.label}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            Overlay seat
            <select
              value={overlaySeat ?? ""}
              onChange={(e) => {
                setOverlaySeat(e.target.value || null);
                if (e.target.value) retry(e.target.value);
              }}
              className={picker}
            >
              <option value="">none</option>
              {seats.filter((s) => s.id !== seat.id).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-panel p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3 px-1 pb-2">
              <p className="readout text-sm">
                <span className="text-trace">Stroke {selected + 1}</span>
                <span className="text-muted-foreground">
                  {" "}· {fmt(current.peak)}
                  {u} at {current.peakPosPct}% · drive {current.driveMs} ms{rate ? ` · ${fmt(rate)} spm` : ""}
                </span>
              </p>
              <p className="readout text-xs text-muted-foreground">
                work {thirds.map((t) => Math.round(t)).join(" · ")} %
              </p>
            </div>
            <CurveCanvas layers={layers} loadFailed={loaded === "failed"} />
            {layers.length > 1 && (
              <ul className="flex flex-wrap gap-4 px-1 pt-2 text-xs text-muted-foreground">
                {layers.map((l) => (
                  <li key={l.label} className="flex items-center gap-2">
                    <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ background: l.colour }} />
                    {l.label} · {fmt(l.stroke.peak)}
                    {u}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Timeline</span>
              {METRICS.slice(0, 4).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={metricId === m.id}
                  onClick={() => setMetricId(m.id)}
                  className={cn(chip, metricId === m.id ? "border-trace/60 bg-trace/10 text-trace" : "text-muted-foreground hover:text-foreground")}
                >
                  {m.label}
                </button>
              ))}
              {compare !== null && (
                <button type="button" onClick={() => setCompare(null)} className={cn(chip, "ml-auto text-warn")}>
                  Clear comparison
                </button>
              )}
            </div>
            <StrokeTimeline strokes={strokes} selected={selected} compare={compare} metricId={metricId} onSelect={setSelected} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Every stroke</p>
            <button type="button" onClick={download} className={cn(chip, "flex items-center gap-2 text-muted-foreground hover:text-foreground")}>
              <Download aria-hidden className="size-3.5" />
              Export CSV
            </button>
          </div>
          <div className="readout grid grid-cols-[2.5rem_4rem_3.5rem_4rem] gap-3 px-3 text-xs text-muted-foreground">
            <span>#</span>
            <span>peak</span>
            <span>pos</span>
            <span>drive</span>
          </div>
          <StrokeList strokes={strokes} selected={selected} compare={compare} onSelect={setSelected} onCompare={setCompare} height={420} />
        </div>
      </div>
    </div>
  );
}

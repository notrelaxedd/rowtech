"use client";

import { useMemo, useState, useTransition } from "react";
import type { StrokeRow } from "@/lib/session/format";
import { fmt } from "@/lib/session/analyse";
import { cn } from "@/lib/utils";

export type CrewSeat = {
  id: string;
  seat: number;
  label: string;
  side: "port" | "starboard" | "scull" | "cox" | null;
  strokes: StrokeRow[];
};

/**
 * The crew, seat by seat. Two of these work on seat nodes alone; catch spread
 * and sequencing need every seat on one clock, which is what Vieve is for, so
 * they say so rather than showing numbers that can't mean anything.
 */
export function CrewPanel({
  seats,
  clockSource,
  clockSyncMs,
  onSetSide,
}: {
  seats: CrewSeat[];
  clockSource: "boot_ms" | "gps";
  clockSyncMs: number | null;
  /** Saves a side; resolves to a message when it wasn't saved. */
  onSetSide?: (seatId: string, side: "port" | "starboard") => Promise<string | null>;
}) {
  const [sides, setSides] = useState<Record<string, "port" | "starboard" | null>>(
    Object.fromEntries(seats.map((s) => [s.id, s.side === "port" || s.side === "starboard" ? s.side : null]))
  );
  const [sideError, setSideError] = useState<string | null>(null);
  const [, startSaving] = useTransition();

  // Load share: each seat's impulse as a share of the crew's, over the piece.
  // Valid without a shared clock: it compares totals, not moments.
  const share = useMemo(() => {
    const totals = seats.map((s) => ({
      seat: s,
      total: s.strokes.reduce((a, k) => a + k.impulse, 0),
      strokes: s.strokes.length,
    }));
    const crew = totals.reduce((a, t) => a + t.total, 0);
    const even = crew / (totals.length || 1);
    return totals.map((t) => ({ ...t, pct: crew ? (t.total / crew) * 100 : 0, off: even ? ((t.total - even) / even) * 100 : 0 }));
  }, [seats]);

  const balance = useMemo(() => {
    const side = (id: string) => sides[id];
    const sum = (which: "port" | "starboard") =>
      share.filter((s) => side(s.seat.id) === which).reduce((a, s) => a + s.total, 0);
    const port = sum("port");
    const star = sum("starboard");
    const known = share.filter((s) => side(s.seat.id)).length;
    return { port, star, known, total: port + star };
  }, [share, sides]);

  const synced = clockSource === "gps";

  // Catch spread, only when the whole crew is on one clock.
  const spread = useMemo(() => {
    if (!synced) return null;
    const n = Math.min(...seats.map((s) => s.strokes.length));
    if (!n) return null;
    const rows = [];
    for (let i = 0; i < n; i++) {
      const times = seats.map((s) => s.strokes[i].catchMs);
      const mean = times.reduce((a, b) => a + b, 0) / times.length;
      rows.push({ i, offsets: seats.map((s, k) => ({ seat: s.seat, ms: times[k] - mean })) });
    }
    const last = rows[rows.length - 1];
    const worst = Math.max(...rows.map((r) => Math.max(...r.offsets.map((o) => o.ms)) - Math.min(...r.offsets.map((o) => o.ms))));
    return { rows, last, worst };
  }, [seats, synced]);

  const maxShare = Math.max(...share.map((s) => s.pct), 1);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-panel p-4">
        <h3 className="type-h3 text-base">Who&rsquo;s carrying the boat</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Each seat&rsquo;s impulse as a share of the crew&rsquo;s, across the whole piece. Amber is more than 5% off an even share.
        </p>
        <ul className="mt-4 space-y-2">
          {share.map((s) => {
            const far = Math.abs(s.off) > 5;
            return (
              <li key={s.seat.id} className="grid grid-cols-[3.5rem_1fr_5.5rem] items-center gap-3">
                <span className="readout text-sm">{s.seat.label}</span>
                <span className="h-3 overflow-hidden rounded-sm bg-white/[0.06]">
                  <span
                    className={cn("block h-full rounded-sm transition-[width] duration-500", far ? "bg-warn" : "bg-trace")}
                    style={{ width: `${(s.pct / maxShare) * 100}%` }}
                  />
                </span>
                <span className={cn("readout text-right text-sm", far ? "text-warn" : "text-muted-foreground")}>
                  {fmt(s.pct)}% {s.off >= 0 ? "+" : "−"}
                  {fmt(Math.abs(s.off))}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h3 className="type-h3 text-base">Port and starboard</h3>
        {balance.known < 2 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Set which side each seat rows and the balance appears. The node doesn&rsquo;t know which rigger it&rsquo;s on.
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Impulse by side over the piece, from the {balance.known} seats you&rsquo;ve set.
          </p>
        )}
        {balance.total > 0 && balance.known >= 2 && (
          <div className="mt-4">
            <div className="flex h-3 overflow-hidden rounded-sm">
              <span className="bg-trace" style={{ width: `${(balance.port / balance.total) * 100}%` }} />
              <span className="bg-ok" style={{ width: `${(balance.star / balance.total) * 100}%` }} />
            </div>
            <div className="readout mt-2 flex justify-between text-sm">
              <span className="text-trace">port {fmt((balance.port / balance.total) * 100)}%</span>
              <span className="text-ok">starboard {fmt((balance.star / balance.total) * 100)}%</span>
            </div>
          </div>
        )}
        <ul className="mt-4 flex flex-wrap gap-2">
          {seats.map((s) => (
            <li key={s.id} className="flex items-center gap-1 rounded-md border border-line px-2 py-1">
              <span className="readout text-xs text-muted-foreground">{s.label}</span>
              {(["port", "starboard"] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  aria-pressed={sides[s.id] === side}
                  onClick={() => {
                    // Shown at once, taken back if it doesn't save.
                    const before = sides[s.id] ?? null;
                    setSides((v) => ({ ...v, [s.id]: side }));
                    setSideError(null);
                    startSaving(async () => {
                      const problem = (await onSetSide?.(s.id, side)) ?? null;
                      if (problem) {
                        setSides((v) => ({ ...v, [s.id]: before }));
                        setSideError(problem);
                      }
                    });
                  }}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace",
                    sides[s.id] === side ? (side === "port" ? "bg-trace/15 text-trace" : "bg-ok/15 text-ok") : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {side === "port" ? "P" : "S"}
                </button>
              ))}
            </li>
          ))}
        </ul>
        {sideError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {sideError}
          </p>
        )}
      </section>

      <section className={cn("rounded-lg border border-line bg-panel p-4", !synced && "opacity-90")}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="type-h3 text-base">Catch spread and sequencing</h3>
          {synced ? (
            <span className="readout text-xs text-trace">
              one clock{clockSyncMs !== null ? ` · within ${fmt(clockSyncMs)} ms` : ""}
            </span>
          ) : (
            <span className="readout text-xs text-warn">needs Vieve</span>
          )}
        </div>

        {synced && spread ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              The last stroke of the piece, each seat against the crew average. Widest spread in the piece: {fmt(spread.worst, 0)} ms.
            </p>
            <ul className="mt-4 space-y-1.5">
              {spread.last.offsets
                .slice()
                .sort((a, b) => a.ms - b.ms)
                .map((o) => {
                  const far = Math.abs(o.ms) > 7;
                  return (
                    <li key={o.seat} className="grid grid-cols-[3rem_1fr_4.5rem] items-center gap-3">
                      <span className="readout text-sm">{o.seat}</span>
                      <span className="relative h-2 rounded-sm bg-white/[0.06]">
                        <span
                          className={cn("absolute top-0 h-full w-1.5 rounded-sm", far ? "bg-warn" : "bg-trace")}
                          style={{ left: `calc(50% + ${Math.max(-48, Math.min(48, o.ms * 2))}%)` }}
                        />
                      </span>
                      <span className={cn("readout text-right text-sm", far ? "text-warn" : "text-muted-foreground")}>
                        {o.ms >= 0 ? "+" : "−"}
                        {fmt(Math.abs(o.ms), 0)} ms
                      </span>
                    </li>
                  );
                })}
            </ul>
          </>
        ) : (
          <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            Every seat node keeps its own clock, counting from the moment it booted, so catch times from two nodes
            can&rsquo;t be compared: the difference between them is mostly when each one was switched on. Vieve puts the
            whole crew on one clock, to within 5 ms across an eight, and this panel fills in from the first outing with
            it in the boat.
          </p>
        )}
      </section>
    </div>
  );
}

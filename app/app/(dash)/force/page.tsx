import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { duration, fmt } from "@/lib/session/analyse";
import { UploadForm } from "./upload-form";
import { HistoryPanel, type HistoryPoint } from "./history-panel";

export const metadata = { title: "Force" };

type SessionRow = {
  id: string;
  kind: "node" | "crew";
  parent_id: string | null;
  seat_number: number | null;
  title: string | null;
  recorded_at: string;
  units: string | null;
  stroke_count: number;
  duration_ms: number | null;
  boats: { name: string } | null;
};

export default async function ForcePage() {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("sessions")
    .select("id, kind, parent_id, seat_number, title, recorded_at, units, stroke_count, duration_ms, boats(name)")
    .order("recorded_at", { ascending: false })
    .limit(200);
  const sessions = (data ?? []) as unknown as SessionRow[];

  const { data: statsData } = await sb
    .from("session_stats")
    .select("session_id, seat_number, recorded_at, avg_peak, avg_rise_rate, avg_peak_pos_pct, avg_drive_ms, avg_recovery_ms, consistency_pct, strokes")
    .order("recorded_at", { ascending: true })
    .limit(500);
  const history = (statsData ?? []).filter((s) => s.seat_number !== null && s.strokes > 0) as HistoryPoint[];

  const children = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    if (!s.parent_id) continue;
    children.set(s.parent_id, [...(children.get(s.parent_id) ?? []), s]);
  }
  const top = sessions.filter((s) => !s.parent_id);

  return (
    <div className="mx-auto w-full max-w-[110rem] space-y-8 px-4 py-8 sm:px-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section>
          <h1 className="type-h3 text-2xl">Sessions</h1>
          {top.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing here yet. Upload a session from a node and it lands here.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line rounded-lg border border-line bg-panel">
              {top.map((s) => {
                const kids = children.get(s.id) ?? [];
                const strokes = s.kind === "crew" ? kids.reduce((a, k) => a + k.stroke_count, 0) : s.stroke_count;
                return (
                  <li key={s.id}>
                    <Link
                      href={`/app/force/${s.id}`}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-trace"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">
                          {s.title || (s.kind === "crew" ? `${kids.length} seats` : `Seat ${s.seat_number ?? "?"}`)}
                        </span>
                        <span className="readout block text-xs text-muted-foreground">
                          {new Date(s.recorded_at).toLocaleString()}
                          {s.boats?.name ? ` · ${s.boats.name}` : ""}
                          {s.kind === "crew" ? ` · ${kids.length} seats` : s.seat_number !== null ? ` · seat ${s.seat_number}` : ""}
                        </span>
                      </span>
                      <span className="readout shrink-0 text-sm text-muted-foreground">
                        {strokes} strokes{s.duration_ms ? ` · ${duration(s.duration_ms)}` : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <UploadForm />
      </div>

      {history.length > 1 && (
        <section>
          <h2 className="type-h3 text-lg">Seat by seat, over time</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Every session so far, by seat. Units are each session&rsquo;s own ({fmt(history.length, 0)} sessions).
          </p>
          <div className="mt-4">
            <HistoryPanel points={history} />
          </div>
        </section>
      )}
    </div>
  );
}

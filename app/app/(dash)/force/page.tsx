import Link from "next/link";
import { readFailed, supabaseServer } from "@/lib/supabase/server";
import { duration, fmt } from "@/lib/session/analyse";
import { LocalTime } from "@/components/dash/local-time";
import { beforeParam, newestFirstPage } from "@/lib/session/older";
import { UploadForm } from "./upload-form";
import { HistoryPanel } from "./history-panel";

export const metadata = { title: "Force" };

/** Most session rows a page of the list shows, and the history chart. */
const LISTED = 200;
const CHARTED = 500;

export default async function ForcePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // ?before= pages back through older sessions; a malformed one is the newest page.
  const before = beforeParam((await searchParams).before);
  const sb = await supabaseServer();
  let query = sb
    .from("sessions")
    .select("id, kind, parent_id, seat_number, title, recorded_at, units, stroke_count, duration_ms, boats(name)");
  if (before) query = query.lt("recorded_at", before);
  const { data, error } = await query.order("recorded_at", { ascending: false }).limit(LISTED + 1);
  if (error) throw await readFailed(error);
  const { rows: sessions, older } = newestFirstPage(data ?? [], LISTED);

  // The newest seat sessions with strokes, back in time order for the chart.
  // Crew rows, empty seats and nodes whose seat was never set are left out in
  // the query, so the cap and the "older ones" line count only what the chart draws.
  const { data: statsData, error: statsError } = await sb
    .from("session_stats")
    .select("session_id, seat_number, recorded_at, avg_peak, avg_rise_rate, avg_peak_pos_pct, avg_drive_ms, avg_recovery_ms, consistency_pct, strokes")
    .not("seat_number", "is", null)
    .gt("strokes", 0)
    .order("recorded_at", { ascending: false })
    .limit(CHARTED + 1);
  if (statsError) throw await readFailed(statsError);
  const moreHistory = (statsData ?? []).length > CHARTED;
  const history = (statsData ?? [])
    .slice(0, CHARTED)
    .reverse()
    // The query already left these out; this tells the type checker.
    .filter((p): p is typeof p & { seat_number: number } => p.seat_number !== null);

  const children = new Map<string, typeof sessions>();
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
              {before ? "No older sessions." : "Nothing here yet. Upload a session from a node and it lands here."}
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
                          <LocalTime at={s.recorded_at} />
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
          {(older || before) && (
            <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {before && (
                <Link href="/app/force" className="text-trace underline-offset-4 hover:underline">
                  ← Newest sessions
                </Link>
              )}
              {older && (
                <Link href={`/app/force?before=${encodeURIComponent(older)}`} className="text-trace underline-offset-4 hover:underline">
                  Older sessions →
                </Link>
              )}
            </p>
          )}
        </section>

        <UploadForm />
      </div>

      {history.length > 1 && (
        <section>
          <h2 className="type-h3 text-lg">Seat by seat, over time</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {moreHistory
              ? "The most recent sessions with a seat set, by seat; older ones aren\u2019t in the chart."
              : "Every session with a seat set, by seat."} Units are each
            session&rsquo;s own ({fmt(history.length, 0)} sessions).
          </p>
          <div className="mt-4">
            <HistoryPanel points={history} />
          </div>
        </section>
      )}
    </div>
  );
}

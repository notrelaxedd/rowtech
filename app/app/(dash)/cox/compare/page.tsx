import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { readFailed, supabaseServer } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { duration, fmt } from "@/lib/session/analyse";
import { ComparePicker } from "./compare-picker";
import { PieceMap } from "@/components/dash/piece-map";
import { sessionTrack } from "@/lib/session/load";
import { thinTrack } from "@/lib/session/track";

export const metadata = { title: "Compare pieces" };

type Crew = { id: string; title: string | null; recorded_at: string; boats: { name: string } | null };

/** Most outings the pickers list. */
const CREWS = 100;

async function piece(sb: Awaited<ReturnType<typeof supabaseServer>>, id: string | undefined) {
  // A missing or malformed id in the URL is nothing picked, not a failed read.
  if (!isUuid(id)) return null;
  const [{ data: session, error }, { data: stats, error: statsError }, fullTrack] = await Promise.all([
    sb.from("sessions").select("id, title, recorded_at, clock_source, boats(name)").eq("id", id).eq("kind", "crew").maybeSingle(),
    sb
      .from("session_stats")
      .select("strokes, avg_peak, avg_impulse, avg_drive_ms, avg_recovery_ms, consistency_pct, span_ms, seat_number")
      .eq("parent_id", id),
    sessionTrack(sb, id),
  ]);
  if (error) throw await readFailed(error);
  if (!session) return null;
  if (statsError) throw await readFailed(statsError);

  const seats = stats ?? [];
  const n = seats.length || 1;
  const avg = (get: (s: (typeof seats)[number]) => number | null) =>
    seats.reduce((a, s) => a + (get(s) ?? 0), 0) / n;

  // The split is over every fix; the map gets a thinned track.
  const splits = fullTrack.map((p) => (p.speedMps && p.speedMps > 0.2 ? 500 / p.speedMps : null)).filter((s): s is number => s !== null);

  return {
    session: session as unknown as Crew,
    seats: seats.length,
    strokes: Math.max(...seats.map((s) => s.strokes ?? 0), 0),
    spanMs: Math.max(...seats.map((s) => s.span_ms ?? 0), 0),
    avgPeak: avg((s) => s.avg_peak),
    avgImpulse: avg((s) => s.avg_impulse),
    avgDrive: avg((s) => s.avg_drive_ms),
    avgRecovery: avg((s) => s.avg_recovery_ms),
    consistency: avg((s) => s.consistency_pct),
    avgSplit: splits.length ? splits.reduce((a, b) => a + b, 0) / splits.length : null,
    track: thinTrack(fullTrack),
  };
}

const split = (s: number | null) => (s === null ? "—" : `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`);

export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("sessions")
    .select("id, title, recorded_at, boats(name)")
    .eq("kind", "crew")
    .order("recorded_at", { ascending: false })
    .limit(CREWS + 1);
  if (error) throw await readFailed(error);
  const more = (data ?? []).length > CREWS;
  const crews = (data ?? []).slice(0, CREWS) as unknown as Crew[];

  const [a, b] = await Promise.all([
    piece(sb, typeof q.a === "string" ? q.a : crews[0]?.id),
    piece(sb, typeof q.b === "string" ? q.b : crews[1]?.id),
  ]);

  const rows: Array<[string, string, string]> = [
    ["Seats", a ? String(a.seats) : "—", b ? String(b.seats) : "—"],
    ["Strokes", a ? String(a.strokes) : "—", b ? String(b.strokes) : "—"],
    ["Time", a ? duration(a.spanMs) : "—", b ? duration(b.spanMs) : "—"],
    ["Avg split", a ? split(a.avgSplit) : "—", b ? split(b.avgSplit) : "—"],
    ["Avg peak", a ? fmt(a.avgPeak) : "—", b ? fmt(b.avgPeak) : "—"],
    ["Avg impulse", a ? fmt(a.avgImpulse) : "—", b ? fmt(b.avgImpulse) : "—"],
    ["Drive : recovery", a ? `1 : ${fmt(a.avgRecovery / (a.avgDrive || 1), 2)}` : "—", b ? `1 : ${fmt(b.avgRecovery / (b.avgDrive || 1), 2)}` : "—"],
    ["Consistency", a ? `CV ${fmt(a.consistency)}%` : "—", b ? `CV ${fmt(b.consistency)}%` : "—"],
  ];

  return (
    <div className="mx-auto w-full max-w-[110rem] space-y-6 px-4 py-8 sm:px-6">
      <div>
        <Link href="/app/cox" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft aria-hidden className="size-3.5" />
          Crew outings
        </Link>
        <h1 className="type-h3 mt-3 text-2xl">Two pieces, side by side</h1>
      </div>

      <ComparePicker crews={crews.map((c) => ({ id: c.id, label: c.title || "Crew outing", at: c.recorded_at }))} a={a?.session.id} b={b?.session.id} />
      {more && <p className="text-sm text-muted-foreground">The lists hold the {CREWS} most recent outings; older ones aren&rsquo;t in them.</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[a, b].map((p, i) => (
          <div key={i} className="space-y-3">
            <h2 className="type-h3 text-base">{p?.session.title || (p ? "Crew outing" : "Nothing picked")}</h2>
            {p && p.track.length > 1 ? (
              <PieceMap track={p.track} />
            ) : (
              <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-muted-foreground">
                No GPS track: that comes from Vieve.
              </div>
            )}
          </div>
        ))}
      </div>

      <table className="w-full max-w-3xl border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-muted-foreground">
            <th className="py-2 font-normal">Measure</th>
            <th className="py-2 font-normal">{a?.session.title || "A"}</th>
            <th className="py-2 font-normal">{b?.session.title || "B"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, va, vb]) => (
            <tr key={k} className="border-b border-line/60">
              <td className="py-2 text-muted-foreground">{k}</td>
              <td className="readout py-2">{va}</td>
              <td className="readout py-2">{vb}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

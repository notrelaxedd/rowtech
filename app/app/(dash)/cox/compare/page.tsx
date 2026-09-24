import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { duration, fmt } from "@/lib/session/analyse";
import { ComparePicker } from "./compare-picker";
import { PieceMap, type TrackPoint } from "@/components/dash/piece-map";

export const metadata = { title: "Compare pieces" };

type Crew = { id: string; title: string | null; recorded_at: string; boats: { name: string } | null };

async function piece(id: string | undefined) {
  if (!id) return null;
  const sb = await supabaseServer();
  const { data: session } = await sb
    .from("sessions")
    .select("id, title, recorded_at, clock_source, boats(name)")
    .eq("id", id)
    .eq("kind", "crew")
    .maybeSingle();
  if (!session) return null;

  const { data: stats } = await sb
    .from("session_stats")
    .select("strokes, avg_peak, avg_impulse, avg_drive_ms, avg_recovery_ms, consistency_pct, span_ms, seat_number")
    .eq("parent_id", id);

  const { data: gps } = await sb
    .from("gps_points")
    .select("t_ms, lat, lon, speed_mps, heading_deg")
    .eq("session_id", id)
    .order("t_ms")
    .limit(20000);

  const seats = stats ?? [];
  const n = seats.length || 1;
  const avg = (get: (s: (typeof seats)[number]) => number | null) =>
    seats.reduce((a, s) => a + (get(s) ?? 0), 0) / n;

  const track: TrackPoint[] = (gps ?? []).map((p) => ({
    tMs: p.t_ms as number,
    lat: p.lat as number,
    lon: p.lon as number,
    speedMps: p.speed_mps as number | null,
    headingDeg: p.heading_deg as number | null,
  }));

  const splits = track.map((p) => (p.speedMps && p.speedMps > 0.2 ? 500 / p.speedMps : null)).filter((s): s is number => s !== null);

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
    track,
  };
}

const split = (s: number | null) => (s === null ? "—" : `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`);

export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const sb = await supabaseServer();
  const { data } = await sb
    .from("sessions")
    .select("id, title, recorded_at, boats(name)")
    .eq("kind", "crew")
    .order("recorded_at", { ascending: false })
    .limit(100);
  const crews = (data ?? []) as unknown as Crew[];

  const a = await piece(typeof q.a === "string" ? q.a : crews[0]?.id);
  const b = await piece(typeof q.b === "string" ? q.b : crews[1]?.id);

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

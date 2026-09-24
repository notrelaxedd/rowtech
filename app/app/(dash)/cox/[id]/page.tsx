import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import type { StrokeRow } from "@/lib/session/format";
import { CrewView } from "./crew-view";

export const metadata = { title: "Crew outing" };

type DbStroke = {
  rec: number; seq: number; catch_ms: number; drive_ms: number; recovery_ms: number;
  peak: number; peak_pos_pct: number; impulse: number; rise_rate: number;
  third1: number; third2: number; third3: number; curve_valid: boolean;
};

const toStroke = (s: DbStroke): StrokeRow => ({
  rec: s.rec, seq: s.seq, catchMs: s.catch_ms, driveMs: s.drive_ms, recoveryMs: s.recovery_ms,
  peak: s.peak, peakPosPct: s.peak_pos_pct, impulse: s.impulse, riseRate: s.rise_rate,
  thirds: [s.third1, s.third2, s.third3], curveValid: s.curve_valid,
});

export default async function CrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();

  const { data: crew } = await sb
    .from("sessions")
    .select("id, kind, title, recorded_at, clock_source, clock_sync_ms, boat_id, boats(name)")
    .eq("id", id)
    .maybeSingle();
  if (!crew || crew.kind !== "crew") notFound();

  const { data: kids } = await sb
    .from("sessions")
    .select("id, seat_number, units, side")
    .eq("parent_id", id)
    .order("seat_number");

  const seats = [];
  for (const k of kids ?? []) {
    const { data: rows } = await sb
      .from("strokes")
      .select("rec, seq, catch_ms, drive_ms, recovery_ms, peak, peak_pos_pct, impulse, rise_rate, third1, third2, third3, curve_valid")
      .eq("session_id", k.id)
      .order("rec");
    const { data: seat } = crew.boat_id
      ? await sb.from("seats").select("side").eq("boat_id", crew.boat_id).eq("seat_number", k.seat_number ?? -1).maybeSingle()
      : { data: null };
    seats.push({
      id: k.id,
      seat: k.seat_number ?? 0,
      label: k.seat_number ? `seat ${k.seat_number}` : "seat ?",
      side: (seat?.side ?? k.side ?? null) as "port" | "starboard" | "scull" | "cox" | null,
      strokes: ((rows ?? []) as DbStroke[]).map(toStroke),
    });
  }

  const { data: gps } = await sb
    .from("gps_points")
    .select("t_ms, lat, lon, speed_mps, heading_deg")
    .eq("session_id", id)
    .order("t_ms")
    .limit(20000);

  const track = (gps ?? []).map((p) => ({
    tMs: p.t_ms as number,
    lat: p.lat as number,
    lon: p.lon as number,
    speedMps: p.speed_mps as number | null,
    headingDeg: p.heading_deg as number | null,
  }));

  const boat = (crew.boats as unknown as { name: string } | null)?.name;

  return (
    <div className="mx-auto w-full max-w-[110rem] space-y-6 px-4 py-8 sm:px-6">
      <div>
        <Link href="/app/cox" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft aria-hidden className="size-3.5" />
          Crew outings
        </Link>
        <h1 className="type-h3 mt-3 text-2xl">{crew.title || "Crew outing"}</h1>
        <p className="readout mt-1 text-sm text-muted-foreground">
          {new Date(crew.recorded_at).toLocaleString()}
          {boat ? ` · ${boat}` : ""} · {seats.length} seats
        </p>
      </div>

      <CrewView
        seats={seats}
        track={track}
        clockSource={crew.clock_source === "gps" ? "gps" : "boot_ms"}
        clockSyncMs={(crew.clock_sync_ms as number | null) ?? null}
      />
    </div>
  );
}

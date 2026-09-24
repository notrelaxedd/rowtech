import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StorageApiError } from "@supabase/supabase-js";
import { readFailed, supabaseServer } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import type { StrokeRow } from "@/lib/session/format";
import { SessionViewer, type SeatSource } from "@/components/dash/session-viewer";
import { LocalTime } from "@/components/dash/local-time";

export const metadata = { title: "Session" };

type DbStroke = {
  rec: number; seq: number; catch_ms: number; drive_ms: number; recovery_ms: number;
  peak: number; peak_pos_pct: number; impulse: number; rise_rate: number;
  third1: number; third2: number; third3: number; curve_valid: boolean;
};

const toStroke = (s: DbStroke): StrokeRow => ({
  rec: s.rec,
  seq: s.seq,
  catchMs: s.catch_ms,
  driveMs: s.drive_ms,
  recoveryMs: s.recovery_ms,
  peak: s.peak,
  peakPosPct: s.peak_pos_pct,
  impulse: s.impulse,
  riseRate: s.rise_rate,
  thirds: [s.third1, s.third2, s.third3],
  curveValid: s.curve_valid,
});

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Not an id at all: there is no such session, rather than a failed read.
  if (!isUuid(id)) notFound();
  const sb = await supabaseServer();

  const { data: session, error } = await sb
    .from("sessions")
    .select("id, kind, parent_id, seat_number, title, recorded_at, units, boats(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw readFailed(error);
  if (!session) notFound();

  // A crew session shows its seats; a seat session shows itself.
  const { data: kids, error: kidsError } = session.kind === "crew"
    ? await sb.from("sessions").select("id, seat_number, units").eq("parent_id", id).order("seat_number")
    : { data: null, error: null };
  if (kidsError) throw readFailed(kidsError);
  const members = kids?.length ? kids : [{ id: session.id, seat_number: session.seat_number, units: session.units }];

  const seats: SeatSource[] = [];
  for (const m of members) {
    const { data: rows, error: rowsError } = await sb
      .from("strokes")
      .select("rec, seq, catch_ms, drive_ms, recovery_ms, peak, peak_pos_pct, impulse, rise_rate, third1, third2, third3, curve_valid")
      .eq("session_id", m.id)
      .order("rec");
    if (rowsError) throw readFailed(rowsError);
    const { data: file, error: fileError } = await sb.from("session_files").select("path").eq("session_id", m.id).eq("kind", "curves").maybeSingle();
    if (fileError) throw readFailed(fileError);
    const signed = file?.path ? await sb.storage.from("sessions").createSignedUrl(file.path, 3600) : null;
    // A curves file Storage doesn't have shows as no curve; Storage not answering is an error.
    if (signed?.error && !(signed.error instanceof StorageApiError && signed.error.statusCode === "404")) throw readFailed(signed.error);
    seats.push({
      id: m.id,
      seat: m.seat_number ?? 0,
      label: m.seat_number ? `seat ${m.seat_number}` : "seat ?",
      units: m.units ?? "",
      strokes: ((rows ?? []) as DbStroke[]).map(toStroke),
      curvesUrl: signed?.data?.signedUrl ?? null,
    });
  }

  const boat = (session.boats as unknown as { name: string } | null)?.name;

  return (
    <div className="mx-auto w-full max-w-[110rem] space-y-6 px-4 py-8 sm:px-6">
      <div>
        <Link href="/app/force" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft aria-hidden className="size-3.5" />
          Sessions
        </Link>
        <h1 className="type-h3 mt-3 text-2xl">
          {session.title || (session.kind === "crew" ? `${seats.length} seats` : `Seat ${session.seat_number ?? "?"}`)}
        </h1>
        <p className="readout mt-1 text-sm text-muted-foreground">
          <LocalTime at={session.recorded_at} />
          {boat ? ` · ${boat}` : ""}
          {session.units ? ` · ${session.units}` : ""}
        </p>
      </div>

      <SessionViewer seats={seats} title={session.title ?? "session"} />
    </div>
  );
}

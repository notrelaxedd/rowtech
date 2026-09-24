import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readFailed, supabaseServer } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { seatStrokes, sessionTrack } from "@/lib/session/load";
import { thinTrack } from "@/lib/session/track";
import type { TableRow } from "@/lib/supabase/types";
import { LocalTime } from "@/components/dash/local-time";
import { CrewView } from "./crew-view";

export const metadata = { title: "Crew outing" };

export default async function CrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Not an id at all: there is no such outing, rather than a failed read.
  if (!isUuid(id)) notFound();
  const sb = await supabaseServer();

  const [{ data: crew, error }, { data: kids, error: kidsError }] = await Promise.all([
    sb
      .from("sessions")
      .select("id, kind, title, recorded_at, clock_source, clock_sync_ms, boat_id, boats(name)")
      .eq("id", id)
      .maybeSingle(),
    sb.from("sessions").select("id, seat_number, units, side").eq("parent_id", id).order("seat_number"),
  ]);
  if (error) throw await readFailed(error);
  if (!crew || crew.kind !== "crew") notFound();
  if (kidsError) throw await readFailed(kidsError);

  const boat = crew.boats?.name;

  return (
    <div className="mx-auto w-full max-w-[110rem] space-y-6 px-4 py-8 sm:px-6">
      <div>
        <Link href="/app/cox" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft aria-hidden className="size-3.5" />
          Crew outings
        </Link>
        <h1 className="type-h3 mt-3 text-2xl">{crew.title || "Crew outing"}</h1>
        <p className="readout mt-1 text-sm text-muted-foreground">
          <LocalTime at={crew.recorded_at} />
          {boat ? ` · ${boat}` : ""} · {kids?.length ?? 0} seats
        </p>
      </div>

      {/* The header shows while the strokes and the track load. */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading strokes…</p>}>
        <Crew
          sb={sb}
          crewId={id}
          boatId={crew.boat_id}
          kids={kids ?? []}
          clockSource={crew.clock_source === "gps" ? "gps" : "boot_ms"}
          clockSyncMs={crew.clock_sync_ms}
        />
      </Suspense>
    </div>
  );
}

type Kid = Pick<TableRow<"sessions">, "id" | "seat_number" | "units" | "side">;

/** Every seat's strokes, the boat's seats and the track, together. */
async function Crew({
  sb,
  crewId,
  boatId,
  kids,
  clockSource,
  clockSyncMs,
}: {
  sb: Awaited<ReturnType<typeof supabaseServer>>;
  crewId: string;
  boatId: string | null;
  kids: Kid[];
  clockSource: "boot_ms" | "gps";
  clockSyncMs: number | null;
}) {
  const [strokes, { data: boatSeats, error: seatsError }, track] = await Promise.all([
    seatStrokes(sb, kids.map((k) => k.id)),
    boatId ? sb.from("seats").select("seat_number, side").eq("boat_id", boatId) : { data: [], error: null },
    sessionTrack(sb, crewId),
  ]);
  if (seatsError) throw await readFailed(seatsError);

  const seats = kids.map((k) => ({
    id: k.id,
    seat: k.seat_number,
    label: k.seat_number !== null ? `seat ${k.seat_number}` : "seat ?",
    side: boatSeats?.find((s) => s.seat_number === k.seat_number)?.side ?? k.side ?? null,
    strokes: strokes.get(k.id) ?? [],
  }));

  return <CrewView seats={seats} track={thinTrack(track)} clockSource={clockSource} clockSyncMs={clockSyncMs} />;
}

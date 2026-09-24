import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readFailed, supabaseServer } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { seatStrokes } from "@/lib/session/load";
import { SessionViewer, type SeatSource } from "@/components/dash/session-viewer";
import { LocalTime } from "@/components/dash/local-time";
import { DeleteSession } from "./delete-session";
import type { TableRow } from "@/lib/supabase/types";

export const metadata = { title: "Session" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Not an id at all: there is no such session, rather than a failed read.
  if (!isUuid(id)) notFound();
  const sb = await supabaseServer();

  // The session and its seats together: a seat session has none.
  const [{ data: session, error }, { data: kids, error: kidsError }] = await Promise.all([
    sb
      .from("sessions")
      .select("id, kind, parent_id, seat_number, title, recorded_at, units, boats(name)")
      .eq("id", id)
      .maybeSingle(),
    sb.from("sessions").select("id, seat_number, units").eq("parent_id", id).order("seat_number"),
  ]);
  if (error) throw await readFailed(error);
  if (!session) notFound();
  if (kidsError) throw await readFailed(kidsError);
  // A crew session shows its seats; a seat session shows itself.
  const members = kids?.length ? kids : [{ id: session.id, seat_number: session.seat_number, units: session.units }];

  const boat = session.boats?.name;

  return (
    <div className="mx-auto w-full max-w-[110rem] space-y-6 px-4 py-8 sm:px-6">
      <div>
        <Link href="/app/force" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft aria-hidden className="size-3.5" />
          Sessions
        </Link>
        <h1 className="type-h3 mt-3 text-2xl">
          {session.title || (session.kind === "crew" ? `${members.length} seats` : `Seat ${session.seat_number ?? "?"}`)}
        </h1>
        <p className="readout mt-1 text-sm text-muted-foreground">
          <LocalTime at={session.recorded_at} />
          {boat ? ` · ${boat}` : ""}
          {session.units ? ` · ${session.units}` : ""}
        </p>
        <DeleteSession id={session.id} seats={kids?.length ?? 0} />
      </div>

      {/* The header shows while the strokes load. */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading strokes…</p>}>
        <Seats sb={sb} members={members} title={session.title ?? "session"} />
      </Suspense>
    </div>
  );
}

type Member = Pick<TableRow<"sessions">, "id" | "seat_number" | "units">;

/** Every seat's strokes and curves file: the same three round trips for one seat or nine. */
async function Seats({ sb, members, title }: { sb: Awaited<ReturnType<typeof supabaseServer>>; members: Member[]; title: string }) {
  const ids = members.map((m) => m.id);
  const [strokes, { data: files, error: filesError }] = await Promise.all([
    seatStrokes(sb, ids),
    sb.from("session_files").select("session_id, path").in("session_id", ids).eq("kind", "curves"),
  ]);
  if (filesError) throw await readFailed(filesError);

  const paths = (files ?? []).map((f) => f.path);
  const signed = paths.length ? await sb.storage.from("sessions").createSignedUrls(paths, 3600) : { data: [], error: null };
  // Storage not answering is an error; a curves file it doesn't have shows as no curve.
  if (signed.error) throw await readFailed(signed.error);
  const urls = new Map(signed.data.map((u) => [u.path, u.signedUrl]));

  const seats: SeatSource[] = members.map((m) => {
    const file = files?.find((f) => f.session_id === m.id);
    return {
      id: m.id,
      seat: m.seat_number ?? 0,
      label: m.seat_number ? `seat ${m.seat_number}` : "seat ?",
      units: m.units ?? "",
      strokes: strokes.get(m.id) ?? [],
      curvesUrl: (file && urls.get(file.path)) || null,
    };
  });

  return <SessionViewer seats={seats} title={title} />;
}

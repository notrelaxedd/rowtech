"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer, getViewer } from "@/lib/supabase/server";
import { parseSession } from "@/lib/session/parse";
import { SessionFormatError, type ParsedSession } from "@/lib/session/format";
import { collectSessions, ZipTooLargeError, type NamedFile, type SessionFolder } from "@/lib/session/collect";
import { looksLikeVieve, VieveNotSupportedError } from "@/lib/session/vieve";
import { isUuid } from "@/lib/uuid";

export type UploadState = { status: "idle" | "error" | "ok"; message: string; sessionId?: string };

const decode = (b: Uint8Array) => new TextDecoder().decode(b);

/**
 * How much one upload, and one team in a day, can add. Far above what a crew
 * rows (an eight and its cox is nine seats; a long practice is ~2,000 strokes
 * a seat), and far below what would fill the database.
 */
const UPLOAD_LIMITS = {
  /** Files picked in one go: nine seats of four files. A zip counts as one. */
  files: 36,
  /** Seat sessions in one upload: an eight and its cox. */
  seats: 9,
  /** Strokes in one seat session. */
  strokes: 20_000,
  /** New seat sessions a team can add in 24 hours. */
  newSessionsPerDay: 200,
};

/** Everything a beta user needs before they can upload: a team of their own. */
async function teamId(viewer: { email: string }): Promise<string> {
  const sb = await supabaseServer();
  // Finds the team, or makes it, in one call that is safe to run twice at once
  // (supabase/migrations/*_own_team.sql).
  const { data, error } = await sb.rpc("ensure_own_team", { p_name: `${viewer.email.split("@")[0]}'s crew` });
  if (error || typeof data !== "string") throw new Error(error?.message ?? "could not set up a team");
  return data;
}

class TooManyFilesError extends Error {
  constructor() {
    super("That's more files than one upload takes. Upload one outing at a time: four files a seat, or a zip.");
  }
}

async function collect(fd: FormData): Promise<Map<string, SessionFolder>> {
  const picked = fd.getAll("files");
  if (picked.length > UPLOAD_LIMITS.files) throw new TooManyFilesError();
  const files: NamedFile[] = [];
  for (const entry of picked) {
    if (!(entry instanceof File) || entry.size === 0) continue;
    files.push({ name: entry.name, bytes: new Uint8Array(await entry.arrayBuffer()) });
  }
  // A Vieve bundle is refused outright rather than half-read: its format
  // isn't final yet (lib/session/vieve.ts).
  if (looksLikeVieve(files)) throw new VieveNotSupportedError();
  return collectSessions(files);
}

/** A date and time with its offset: 2026-09-24T10:00:00.000Z, or ...T06:00-04:00. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * When the session was rowed. The node has no clock, so this is what the coach
 * typed, sent by the form as an instant (upload-form.tsx). A time with no
 * offset would be read in this server's zone, which isn't the coach's, so it's
 * refused (null) rather than guessed at. Left blank, it's now.
 */
function readRecordedAt(v: FormDataEntryValue | null): Date | null {
  if (v === null || v === "") return new Date();
  if (typeof v !== "string" || !INSTANT.test(v)) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function uploadSession(_prev: UploadState, fd: FormData): Promise<UploadState> {
  const viewer = await getViewer();
  if (viewer.state === "error") return { status: "error", message: "The upload couldn't be saved. Try again in a minute." };
  if (viewer.state !== "allowed") return { status: "error", message: "Sign in with a beta account to upload." };

  let folders: Map<string, SessionFolder>;
  try {
    folders = await collect(fd);
  } catch (e) {
    if (e instanceof VieveNotSupportedError || e instanceof ZipTooLargeError || e instanceof TooManyFilesError) {
      return { status: "error", message: e.message };
    }
    return { status: "error", message: "That zip couldn't be opened." };
  }

  if (folders.size > UPLOAD_LIMITS.seats) {
    return { status: "error", message: "That's more than nine seats. Upload one outing at a time." };
  }

  const parsed: Array<{ key: string; session: ParsedSession; raw: SessionFolder }> = [];
  for (const [key, folder] of folders) {
    if (!folder.meta || !folder.strokes) continue;
    try {
      parsed.push({
        key,
        raw: folder,
        session: parseSession({
          meta: decode(folder.meta),
          strokes: decode(folder.strokes),
          events: folder.events ? decode(folder.events) : undefined,
          curves: folder.curves,
        }),
      });
    } catch (e) {
      const where = folders.size > 1 ? `${key}: ` : "";
      if (e instanceof SessionFormatError) return { status: "error", message: `${where}${e.message}` };
      return { status: "error", message: `${where}that session couldn't be read.` };
    }
  }

  const long = parsed.find(({ session }) => session.strokes.length > UPLOAD_LIMITS.strokes);
  if (long) {
    const where = folders.size > 1 ? `${long.key}: ` : "";
    return { status: "error", message: `${where}that session has more than 20,000 strokes, more than one upload takes.` };
  }

  if (!parsed.length) {
    return {
      status: "error",
      message: "Pick a session folder with meta.json and strokes.csv in it (curves.bin and events.csv too, if you have them), or a zip of one.",
    };
  }

  const keys = parsed.map(({ session }) => `${session.meta.deviceId}/${session.meta.uuid}`);
  if (new Set(keys).size !== keys.length) {
    return { status: "error", message: "Two of those folders hold the same session. Pick each seat's folder once." };
  }

  const recordedAt = readRecordedAt(fd.get("recorded_at"));
  if (!recordedAt) return { status: "error", message: "That date and time couldn't be read. Pick it again." };
  const boatName = (fd.get("boat") as string | null)?.trim() ?? "";
  const title = (fd.get("title") as string | null)?.trim() ?? "";
  // The form says so too, but a request doesn't have to come from the form.
  if (boatName.length > 120) return { status: "error", message: "Keep the boat name under 120 characters." };
  if (title.length > 120) return { status: "error", message: "Keep the piece's name under 120 characters." };

  const sb = await supabaseServer();
  let team: string;
  try {
    team = await teamId(viewer);
  } catch (e) {
    console.error("team setup failed", e);
    return { status: "error", message: "We couldn't set your team up. Try again in a minute." };
  }

  // A session already uploaded keeps its id, so its files stay where they are;
  // a new one gets its id here, so its files can be stored before its row.
  const { data: known, error: lookupError } = await sb
    .from("sessions")
    .select("id, device_id, session_uuid")
    .eq("team_id", team)
    .in("session_uuid", parsed.map((p) => p.session.meta.uuid));
  if (lookupError) {
    console.error("upload: session lookup failed", { code: lookupError.code, message: lookupError.message });
    return { status: "error", message: "The upload couldn't be saved. Try again in a minute." };
  }
  const idOf = new Map((known ?? []).map((r) => [`${r.device_id}/${r.session_uuid}`, r.id as string]));
  const seats = parsed.map(({ session, raw }) => {
    const id = idOf.get(`${session.meta.deviceId}/${session.meta.uuid}`);
    return { session, raw, id: id ?? crypto.randomUUID(), isNew: !id, files: [] as Array<{ kind: string; path: string; bytes: number }> };
  });

  const newSessions = seats.filter((s) => s.isNew).length;
  if (newSessions) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await sb
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team)
      .eq("kind", "node")
      .gte("created_at", since);
    if (countError || count === null) {
      console.error("upload: quota check failed", { code: countError?.code, message: countError?.message });
      return { status: "error", message: "The upload couldn't be saved. Try again in a minute." };
    }
    if (count + newSessions > UPLOAD_LIMITS.newSessionsPerDay) {
      return { status: "error", message: "Your team has uploaded as many sessions as one day allows. Try again tomorrow." };
    }
  }

  // New sessions' files, removed again if their rows don't land. A re-upload
  // overwrites the same session's files in place, so there is nothing to undo.
  const stored: string[] = [];
  const discard = async () => {
    if (!stored.length) return;
    const { error } = await sb.storage.from("sessions").remove(stored);
    if (error) console.error("upload: cleanup failed", { paths: stored, message: error.message });
  };

  // The files themselves, exactly as they came off the card. Stored first, so
  // no row ever points at a file that isn't there.
  for (const seat of seats) {
    const { raw } = seat;
    const files: Array<[kind: "meta" | "strokes" | "curves" | "events", name: string, bytes: Uint8Array | undefined]> = [
      ["meta", "meta.json", raw.meta],
      ["strokes", "strokes.csv", raw.strokes],
      ["curves", "curves.bin", raw.curves],
      ["events", "events.csv", raw.events],
    ];
    for (const [kind, name, bytes] of files) {
      if (!bytes) continue;
      const path = `${team}/${seat.id}/${name}`;
      const { error: upErr } = await sb.storage
        .from("sessions")
        .upload(path, new Blob([bytes as BlobPart]), { upsert: true, contentType: name.endsWith(".bin") ? "application/octet-stream" : name.endsWith(".json") ? "application/json" : "text/csv" });
      if (upErr) {
        console.error("upload: file not stored", { path, message: upErr.message });
        await discard();
        return { status: "error", message: `${name} couldn't be stored. Try again in a minute.` };
      }
      if (seat.isNew) stored.push(path);
      seat.files.push({ kind, path, bytes: bytes.byteLength });
    }
  }

  // Then every row -- boat, crew, seats, strokes, file rows -- in one
  // transaction (supabase/migrations/*_ingest_sessions.sql).
  const { data: saved, error: saveError } = await sb.rpc("ingest_sessions", {
    p_team: team,
    p_boat_name: boatName,
    p_title: title,
    p_recorded_at: recordedAt.toISOString(),
    p_seats: seats.map(({ id, session, raw, files }) => ({
      id,
      device_id: session.meta.deviceId,
      session_uuid: session.meta.uuid,
      seat_number: session.meta.seat,
      format: session.meta.format,
      units: session.meta.units,
      sample_rate: session.meta.sampleRate,
      curve_points: session.meta.curvePoints,
      curve_scale: session.meta.curveScale,
      duration_ms: session.meta.elapsedMs,
      meta: JSON.parse(decode(raw.meta!)) as Record<string, unknown>,
      strokes: session.strokes.map((s) => [
        s.rec, s.seq, s.catchMs, s.driveMs, s.recoveryMs, s.peak, s.peakPosPct,
        s.impulse, s.riseRate, s.thirds[0], s.thirds[1], s.thirds[2], s.curveValid,
      ]),
      files,
    })),
  });
  if (saveError || !saved) {
    console.error("upload: rows not saved", { code: saveError?.code, message: saveError?.message });
    await discard();
    return { status: "error", message: "The upload couldn't be saved. Try again in a minute." };
  }

  revalidatePath("/app/force");
  const { parent, sessions } = saved as { parent: string | null; sessions: string[] };
  return { status: "ok", message: "", sessionId: parent ?? sessions[0] };
}

/** Removes a session, its seats if it is a crew session, and their files. */
export async function deleteSession(id: string): Promise<void> {
  if (!isUuid(id)) return;
  // RLS is the real gate; this keeps a removed beta user out even if it weren't.
  if ((await getViewer()).state !== "allowed") return;
  const sb = await supabaseServer();
  const { data: kids, error: kidsError } = await sb.from("sessions").select("id").eq("parent_id", id);
  const ids = [id, ...(kids ?? []).map((k) => k.id)];
  const { data: files, error: filesError } = await sb.from("session_files").select("path").in("session_id", ids);
  if (kidsError || filesError) {
    console.error("delete: lookup failed", { message: (kidsError ?? filesError)?.message });
    return;
  }

  // The rows first, so a failure leaves everything as it was. The seats, their
  // strokes and file rows go with the session (the foreign keys cascade).
  const { data: deleted, error } = await sb.from("sessions").delete().eq("id", id).select("id");
  if (error || !deleted?.length) {
    console.error("delete: session not deleted", { id, message: error?.message ?? "no row deleted" });
    return;
  }
  // Then the files. If this fails they are orphaned in Storage, but no row
  // points at a file that's gone.
  if (files?.length) {
    const { error: removeError } = await sb.storage.from("sessions").remove(files.map((f) => f.path));
    if (removeError) console.error("delete: files not removed", { id, message: removeError.message });
  }
  revalidatePath("/app/force");
}

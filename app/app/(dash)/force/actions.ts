"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer, getViewer } from "@/lib/supabase/server";
import { parseSession } from "@/lib/session/parse";
import { SessionFormatError, type ParsedSession } from "@/lib/session/format";
import { collectSessions, ZipTooLargeError, type NamedFile, type SessionFolder } from "@/lib/session/collect";
import { looksLikeVieve, VieveNotSupportedError } from "@/lib/session/vieve";
import { isUuid } from "@/lib/uuid";
import type { Json } from "@/lib/supabase/database.types";

/** An error's message, and when several seats fail, each seat's reason in `errors`. */
export type UploadState = { status: "idle" | "error" | "ok"; message: string; errors?: string[]; sessionId?: string };

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

/**
 * A new team's name. Nothing from the user's email (LEG-018): the team's
 * members see its name. Teams made before this keep the names they have.
 */
const NEW_TEAM_NAME = "My crew";

/** Everything a beta user needs before they can upload: a team of their own. */
async function teamId(): Promise<string> {
  const sb = await supabaseServer();
  // Finds the team, or makes it, in one call that is safe to run twice at once
  // (supabase/migrations/*_own_team.sql).
  const { data, error } = await sb.rpc("ensure_own_team", { p_name: NEW_TEAM_NAME });
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
 * refused (null) rather than guessed at. That includes a time typed with no
 * script to turn it into an instant (typed, the field's own value). Left
 * blank, it's now.
 */
function readRecordedAt(v: FormDataEntryValue | null, typed: FormDataEntryValue | null): Date | null {
  if (v === null || v === "") return typed === null || typed === "" ? new Date() : null;
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

  const parsed: Array<{ key: string; session: ParsedSession; raw: SessionFolder & { meta: Uint8Array } }> = [];
  // Every seat is read before any is refused, so the coach hears about all of them at once.
  const unread: string[] = [];
  for (const [key, folder] of folders) {
    const { meta, strokes } = folder;
    if (!meta || !strokes) continue;
    try {
      parsed.push({
        key,
        raw: { ...folder, meta },
        session: parseSession({
          meta: decode(meta),
          strokes: decode(strokes),
          events: folder.events ? decode(folder.events) : undefined,
          curves: folder.curves,
        }),
      });
    } catch (e) {
      // Named after its folder when there are several; on its own, the
      // reason starts the sentence (a format error starts with a file name).
      const where = folders.size > 1 ? `${key}: ` : "";
      const why = e instanceof SessionFormatError ? e.message : `${where ? "that" : "That"} session couldn't be read.`;
      unread.push(`${where}${why}`);
    }
  }
  if (unread.length === 1) return { status: "error", message: unread[0] };
  if (unread.length > 1) return { status: "error", message: `${unread.length} seats couldn't be read.`, errors: unread };

  const long = parsed.find(({ session }) => session.strokes.length > UPLOAD_LIMITS.strokes);
  if (long) {
    const where = folders.size > 1 ? `${long.key}: that` : "That";
    return { status: "error", message: `${where} session has more than 20,000 strokes, more than one upload takes.` };
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

  const recordedAt = readRecordedAt(fd.get("recorded_at"), fd.get("recorded_local"));
  if (!recordedAt) return { status: "error", message: "That date and time couldn't be read. Pick it again." };
  const boatName = (fd.get("boat") as string | null)?.trim() ?? "";
  const title = (fd.get("title") as string | null)?.trim() ?? "";
  // The form says so too, but a request doesn't have to come from the form.
  if (boatName.length > 120) return { status: "error", message: "Keep the boat name under 120 characters." };
  if (title.length > 120) return { status: "error", message: "Keep the session name under 120 characters." };

  const sb = await supabaseServer();
  let team: string;
  try {
    team = await teamId();
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
  const idOf = new Map((known ?? []).map((r) => [`${r.device_id}/${r.session_uuid}`, r.id]));
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

  // The files themselves, exactly as they came off the card, every seat's at
  // once. Stored first, so no row ever points at a file that isn't there.
  const uploads = seats.flatMap((seat) => {
    const { raw } = seat;
    const files: Array<[kind: "meta" | "strokes" | "curves" | "events", name: string, bytes: Uint8Array | undefined]> = [
      ["meta", "meta.json", raw.meta],
      ["strokes", "strokes.csv", raw.strokes],
      ["curves", "curves.bin", raw.curves],
      ["events", "events.csv", raw.events],
    ];
    return files.flatMap(([kind, name, bytes]) => {
      if (!bytes) return [];
      const path = `${team}/${seat.id}/${name}`;
      seat.files.push({ kind, path, bytes: bytes.byteLength });
      return [{ seat, name, path, bytes }];
    });
  });
  // Each resolves to why it failed, or null; a throw counts as a failure too,
  // so every upload has finished before anything is cleaned up.
  const results = await Promise.all(
    uploads.map(async ({ name, path, bytes }) => {
      try {
        const { error } = await sb.storage
          .from("sessions")
          .upload(path, new Blob([bytes as BlobPart]), { upsert: true, contentType: name.endsWith(".bin") ? "application/octet-stream" : name.endsWith(".json") ? "application/json" : "text/csv" });
        return error?.message ?? null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    })
  );

  // New sessions' files, removed again if their rows don't land. A new
  // session's id is fresh, so its folder holds only this upload's files; one
  // that failed may still have landed, so it goes too. A re-upload overwrites
  // the same session's files in place, so there is nothing to undo.
  const stored = uploads.filter((u) => u.seat.isNew).map((u) => u.path);
  const discard = async () => {
    if (!stored.length) return;
    const { error } = await sb.storage.from("sessions").remove(stored);
    if (error) console.error("upload: cleanup failed", { paths: stored, message: error.message });
  };

  const failed = results.findIndex((r) => r !== null);
  if (failed !== -1) {
    const notStored = uploads.flatMap((u, i) => (results[i] === null ? [] : [{ path: u.path, message: results[i] }]));
    console.error("upload: files not stored", notStored);
    await discard();
    return { status: "error", message: `${uploads[failed].name} couldn't be stored. Try again in a minute.` };
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
      meta: JSON.parse(decode(raw.meta)) as Json,
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

  // A crew upload shows on /app/cox and its compare page too.
  revalidatePath("/app", "layout");
  const { parent, sessions } = saved as { parent: string | null; sessions: string[] };
  return { status: "ok", message: "", sessionId: parent ?? sessions[0] };
}

export type DeleteResult = { ok: true } | { ok: false; message: string };

const NOT_DELETED: DeleteResult = { ok: false, message: "The session wasn't deleted. Try again in a minute." };

/**
 * Removes a session, its seats if it is a crew session, and their files. A
 * seat's crew goes too once it has no seats left.
 */
export async function deleteSession(id: string): Promise<DeleteResult> {
  if (!isUuid(id)) return NOT_DELETED;
  // RLS is the real gate; this keeps a removed beta user out even if it weren't.
  const viewer = await getViewer();
  if (viewer.state === "error") return NOT_DELETED;
  if (viewer.state !== "allowed") return { ok: false, message: "Sign in with a beta account to delete a session." };
  const sb = await supabaseServer();
  const [{ data: session, error: sessionError }, { data: kids, error: kidsError }] = await Promise.all([
    sb.from("sessions").select("id, parent_id").eq("id", id).maybeSingle(),
    sb.from("sessions").select("id").eq("parent_id", id),
  ]);
  const ids = [id, ...(kids ?? []).map((k) => k.id)];
  const { data: files, error: filesError } = await sb.from("session_files").select("path").in("session_id", ids);
  if (sessionError || kidsError || filesError) {
    console.error("delete: lookup failed", { message: (sessionError ?? kidsError ?? filesError)?.message });
    return NOT_DELETED;
  }
  if (!session) return { ok: false, message: "That session isn't there any more." };

  // The rows first, so a failure leaves everything as it was. The seats, their
  // strokes and file rows go with the session (the foreign keys cascade).
  const { data: deleted, error } = await sb.from("sessions").delete().eq("id", id).select("id");
  if (error) {
    console.error("delete: session not deleted", { id, code: error.code, message: error.message });
    return NOT_DELETED;
  }
  // The row is there (it was just read), so RLS kept it: only owners and
  // coaches delete sessions (supabase/migrations/*_team_roles.sql).
  if (!deleted?.length) return { ok: false, message: "Only the team's owner or a coach can delete a session." };

  // Then the files. If this fails they are orphaned in Storage, but no row
  // points at a file that's gone.
  if (files?.length) {
    const { error: removeError } = await sb.storage.from("sessions").remove(files.map((f) => f.path));
    if (removeError) console.error("delete: files not removed", { id, message: removeError.message });
  }

  // A crew with no seats left shows as an empty outing; an upload never leaves
  // one (ingest_sessions), so neither does this.
  if (session.parent_id) {
    const { count, error: countError } = await sb
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", session.parent_id);
    const { error: parentError } = count === 0 ? await sb.from("sessions").delete().eq("id", session.parent_id) : { error: countError };
    if (parentError) console.error("delete: empty crew not removed", { id: session.parent_id, message: parentError.message });
  }

  revalidatePath("/app", "layout");
  return { ok: true };
}

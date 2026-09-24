"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer, getViewer } from "@/lib/supabase/server";
import { parseSession } from "@/lib/session/parse";
import { SessionFormatError, type ParsedSession } from "@/lib/session/format";
import { collectSessions, ZipTooLargeError, type NamedFile, type SessionFolder } from "@/lib/session/collect";
import { looksLikeVieve, VieveNotSupportedError } from "@/lib/session/vieve";

export type UploadState = { status: "idle" | "error" | "ok"; message: string; sessionId?: string };

const decode = (b: Uint8Array) => new TextDecoder().decode(b);

/** Everything a beta user needs before they can upload: a team of their own. */
async function teamId(viewer: { email: string }): Promise<string> {
  const sb = await supabaseServer();
  // Finds the team, or makes it, in one call that is safe to run twice at once
  // (supabase/migrations/*_own_team.sql).
  const { data, error } = await sb.rpc("ensure_own_team", { p_name: `${viewer.email.split("@")[0]}'s crew` });
  if (error || typeof data !== "string") throw new Error(error?.message ?? "could not set up a team");
  return data;
}

async function collect(fd: FormData): Promise<Map<string, SessionFolder>> {
  const files: NamedFile[] = [];
  for (const entry of fd.getAll("files")) {
    if (!(entry instanceof File) || entry.size === 0) continue;
    files.push({ name: entry.name, bytes: new Uint8Array(await entry.arrayBuffer()) });
  }
  // A Vieve bundle is refused outright rather than half-read: its format
  // isn't final yet (lib/session/vieve.ts).
  if (looksLikeVieve(files)) throw new VieveNotSupportedError();
  return collectSessions(files);
}

export async function uploadSession(_prev: UploadState, fd: FormData): Promise<UploadState> {
  const viewer = await getViewer();
  if (viewer.state !== "allowed") return { status: "error", message: "Sign in with a beta account to upload." };

  let folders: Map<string, SessionFolder>;
  try {
    folders = await collect(fd);
  } catch (e) {
    if (e instanceof VieveNotSupportedError || e instanceof ZipTooLargeError) return { status: "error", message: e.message };
    return { status: "error", message: "That zip couldn't be opened." };
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

  const recordedAt = (() => {
    const v = fd.get("recorded_at");
    const d = typeof v === "string" && v ? new Date(v) : new Date();
    return Number.isNaN(d.getTime()) ? new Date() : d;
  })();
  const boatName = (fd.get("boat") as string | null)?.trim() ?? "";
  const title = (fd.get("title") as string | null)?.trim() ?? "";

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
  // RLS is the real gate; this keeps a removed beta user out even if it weren't.
  if ((await getViewer()).state !== "allowed") return;
  const sb = await supabaseServer();
  const { data: kids } = await sb.from("sessions").select("id").eq("parent_id", id);
  const ids = [id, ...(kids ?? []).map((k) => k.id)];
  const { data: files } = await sb.from("session_files").select("path").in("session_id", ids);
  if (files?.length) await sb.storage.from("sessions").remove(files.map((f) => f.path));
  // The children go with the parent: sessions.parent_id cascades.
  await sb.from("sessions").delete().eq("id", id);
  revalidatePath("/app/force");
}

"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer, getViewer } from "@/lib/supabase/server";
import { parseSession } from "@/lib/session/parse";
import { SessionFormatError, type ParsedSession } from "@/lib/session/format";
import { collectSessions, type NamedFile, type SessionFolder } from "@/lib/session/collect";

export type UploadState = { status: "idle" | "error" | "ok"; message: string; sessionId?: string };

const decode = (b: Uint8Array) => new TextDecoder().decode(b);

/** Everything a beta user needs before they can upload: a team of their own. */
async function teamId(): Promise<string> {
  const viewer = await getViewer();
  if (viewer.state !== "allowed") throw new Error("not allowed");
  const sb = await supabaseServer();

  const { data: mine } = await sb.from("team_members").select("team_id").limit(1).maybeSingle();
  if (mine?.team_id) return mine.team_id;

  const name = `${viewer.email.split("@")[0]}'s crew`;
  const { data: team, error } = await sb.from("teams").insert({ name, created_by: viewer.id }).select("id").single();
  if (error || !team) throw new Error(error?.message ?? "could not create a team");
  const { error: joinError } = await sb.from("team_members").insert({ team_id: team.id, user_id: viewer.id, role: "owner" });
  if (joinError) throw new Error(joinError.message);
  return team.id;
}

async function collect(fd: FormData): Promise<Map<string, SessionFolder>> {
  const files: NamedFile[] = [];
  for (const entry of fd.getAll("files")) {
    if (!(entry instanceof File) || entry.size === 0) continue;
    files.push({ name: entry.name, bytes: new Uint8Array(await entry.arrayBuffer()) });
  }
  return collectSessions(files);
}

export async function uploadSession(_prev: UploadState, fd: FormData): Promise<UploadState> {
  const viewer = await getViewer();
  if (viewer.state !== "allowed") return { status: "error", message: "Sign in with a beta account to upload." };

  let folders: Map<string, SessionFolder>;
  try {
    folders = await collect(fd);
  } catch {
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
    team = await teamId();
  } catch (e) {
    console.error("team setup failed", e);
    return { status: "error", message: "We couldn't set your team up. Try again in a minute." };
  }

  // The boat is named at upload: the node's meta.json doesn't record one.
  let boatId: string | null = null;
  if (boatName) {
    const { data: existing } = await sb.from("boats").select("id").eq("team_id", team).eq("name", boatName).maybeSingle();
    if (existing?.id) boatId = existing.id;
    else {
      const { data: made, error } = await sb.from("boats").insert({ team_id: team, name: boatName }).select("id").single();
      if (error) return { status: "error", message: `The boat couldn't be saved: ${error.message}` };
      boatId = made?.id ?? null;
    }
  }

  // Several seats in one upload become a crew session that owns them.
  let parentId: string | null = null;
  if (parsed.length > 1) {
    const { data: parent, error } = await sb
      .from("sessions")
      .insert({
        team_id: team,
        kind: "crew",
        boat_id: boatId,
        title: title || `${parsed.length} seats`,
        recorded_at: recordedAt.toISOString(),
        created_by: viewer.id,
      })
      .select("id")
      .single();
    if (error || !parent) return { status: "error", message: `The upload couldn't be saved: ${error?.message ?? "unknown error"}` };
    parentId = parent.id;
  }

  let firstId = parentId;
  for (const { session, raw } of parsed) {
    const { meta, strokes } = session;
    const { data: row, error } = await sb
      .from("sessions")
      .upsert(
        {
          team_id: team,
          kind: "node",
          parent_id: parentId,
          boat_id: boatId,
          seat_number: meta.seat,
          title: title || null,
          recorded_at: recordedAt.toISOString(),
          device_id: meta.deviceId,
          session_uuid: meta.uuid,
          format: meta.format,
          units: meta.units,
          sample_rate: meta.sampleRate,
          curve_points: meta.curvePoints,
          curve_scale: meta.curveScale,
          stroke_count: strokes.length,
          duration_ms: meta.elapsedMs,
          meta: JSON.parse(decode(raw.meta!)) as Record<string, unknown>,
          created_by: viewer.id,
        },
        { onConflict: "team_id,device_id,session_uuid" }
      )
      .select("id")
      .single();
    if (error || !row) return { status: "error", message: `The session couldn't be saved: ${error?.message ?? "unknown error"}` };
    firstId ??= row.id;

    // Re-uploading the same session replaces its strokes rather than doubling them.
    await sb.from("strokes").delete().eq("session_id", row.id);
    const rows = strokes.map((s) => ({
      session_id: row.id,
      rec: s.rec,
      seq: s.seq,
      catch_ms: s.catchMs,
      drive_ms: s.driveMs,
      recovery_ms: s.recoveryMs,
      peak: s.peak,
      peak_pos_pct: s.peakPosPct,
      impulse: s.impulse,
      rise_rate: s.riseRate,
      third1: s.thirds[0],
      third2: s.thirds[1],
      third3: s.thirds[2],
      curve_valid: s.curveValid,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error: strokeError } = await sb.from("strokes").insert(rows.slice(i, i + 500));
      if (strokeError) return { status: "error", message: `The strokes couldn't be saved: ${strokeError.message}` };
    }

    // The files themselves, exactly as they came off the card.
    const files: Array<[kind: "meta" | "strokes" | "curves" | "events", name: string, bytes: Uint8Array | undefined]> = [
      ["meta", "meta.json", raw.meta],
      ["strokes", "strokes.csv", raw.strokes],
      ["curves", "curves.bin", raw.curves],
      ["events", "events.csv", raw.events],
    ];
    for (const [kind, name, bytes] of files) {
      if (!bytes) continue;
      const path = `${team}/${row.id}/${name}`;
      const { error: upErr } = await sb.storage
        .from("sessions")
        .upload(path, new Blob([bytes as BlobPart]), { upsert: true, contentType: name.endsWith(".bin") ? "application/octet-stream" : name.endsWith(".json") ? "application/json" : "text/csv" });
      if (upErr) return { status: "error", message: `${name} couldn't be stored: ${upErr.message}` };
      await sb.from("session_files").upsert({ session_id: row.id, kind, path, bytes: bytes.byteLength }, { onConflict: "session_id,kind" });
    }
  }

  revalidatePath("/app/force");
  return { status: "ok", message: "", sessionId: firstId ?? undefined };
}

/** Removes a session, its seats if it is a crew session, and their files. */
export async function deleteSession(id: string): Promise<void> {
  const sb = await supabaseServer();
  const { data: kids } = await sb.from("sessions").select("id").eq("parent_id", id);
  const ids = [id, ...(kids ?? []).map((k) => k.id)];
  const { data: files } = await sb.from("session_files").select("path").in("session_id", ids);
  if (files?.length) await sb.storage.from("sessions").remove(files.map((f) => f.path));
  // The children go with the parent: sessions.parent_id cascades.
  await sb.from("sessions").delete().eq("id", id);
  revalidatePath("/app/force");
}

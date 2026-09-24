// Row-level security, checked the way an attacker would try it: straight at
// the API with the publishable key and a real user's session, no app in
// between. Runs against a local Supabase only (tests/support/local-supabase.ts).
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { addToTeam, localSupabaseMissing, makeUser, revoke, type TestUser } from "./support/local-supabase";

test.skip(!!localSupabaseMissing, localSupabaseMissing ?? "");

/** A user with a team, one session in it and one file in its Storage folder. */
async function crewWithData() {
  const user = await makeUser();
  const { data: team, error } = await user.db.rpc("ensure_own_team", { p_name: "test crew" });
  if (error) throw error;
  const session = randomUUID();
  const { error: insertError } = await user.db
    .from("sessions")
    .insert({ id: session, team_id: team, kind: "node", device_id: "node-1", session_uuid: randomUUID(), created_by: user.id });
  if (insertError) throw insertError;
  const path = `${team}/${session}/meta.json`;
  const { error: fileError } = await user.db.storage.from("sessions").upload(path, new Blob(["{}"]), { contentType: "application/json" });
  if (fileError) throw fileError;
  return { user, team: team as string, session, path };
}

const sessionsSeenBy = async (user: TestUser) => (await user.db.from("sessions").select("id")).data ?? [];

test("a beta user can't add themselves to someone else's team", async () => {
  const victim = await crewWithData();
  const intruder = await makeUser();

  for (const role of ["owner", "coach", "member"]) {
    const { error } = await intruder.db.from("team_members").insert({ team_id: victim.team, user_id: intruder.id, role });
    expect(error?.message, role).toMatch(/row-level security/);
  }
  expect(await sessionsSeenBy(intruder)).toEqual([]);
});

test("in their own team, a user can only be the owner", async () => {
  const user = await makeUser();
  const team = randomUUID();
  await user.db.from("teams").insert({ id: team, name: "mine", created_by: user.id });
  const { error } = await user.db.from("team_members").insert({ team_id: team, user_id: user.id, role: "member" });
  expect(error?.message).toMatch(/row-level security/);
});

test("taking someone off the beta list takes their team's data away too", async () => {
  const { user, session, path } = await crewWithData();
  expect(await sessionsSeenBy(user)).toEqual([{ id: session }]);

  await revoke(user.email);

  // Same session token, straight at the API.
  expect(await sessionsSeenBy(user)).toEqual([]);
  const { data: deleted } = await user.db.from("sessions").delete().eq("id", session).select("id");
  expect(deleted).toEqual([]);
  const { error: readError } = await user.db.storage.from("sessions").download(path);
  expect(readError).toBeTruthy();
});

test("the sessions bucket won't hold a file a browser would render as a page", async () => {
  const { user, team } = await crewWithData();
  const page = new Blob(["<script>alert(1)</script>"], { type: "text/html" });
  const { error } = await user.db.storage.from("sessions").upload(`${team}/${randomUUID()}/page.html`, page);
  expect(error?.message).toMatch(/mime type/i);
});

test("roles: members can't delete sessions, anyone can leave, only owners delete the team", async () => {
  const { user: owner, team, session } = await crewWithData();
  const member = await makeUser();
  await addToTeam(team, member, "member");
  expect(await sessionsSeenBy(member)).toEqual([{ id: session }]);

  const { data: notDeleted } = await member.db.from("sessions").delete().eq("id", session).select("id");
  expect(notDeleted).toEqual([]);
  const { data: teamKept } = await member.db.from("teams").delete().eq("id", team).select("id");
  expect(teamKept).toEqual([]);

  const { data: left } = await member.db.from("team_members").delete().eq("team_id", team).eq("user_id", member.id).select("user_id");
  expect(left).toEqual([{ user_id: member.id }]);
  expect(await sessionsSeenBy(member)).toEqual([]);

  const { data: gone } = await owner.db.from("teams").delete().eq("id", team).select("id");
  expect(gone).toEqual([{ id: team }]);
  expect(await sessionsSeenBy(owner)).toEqual([]);
});

test("a file row can only point into its own team's folder", async () => {
  const { user, team, session } = await crewWithData();
  const other = await crewWithData();
  const { error: foreign } = await user.db
    .from("session_files")
    .insert({ session_id: session, kind: "meta", path: `${other.team}/${other.session}/meta.json` });
  expect(foreign?.message).toMatch(/row-level security/);
  const { error: own } = await user.db
    .from("session_files")
    .insert({ session_id: session, kind: "meta", path: `${team}/${session}/meta.json` });
  expect(own).toBeNull();
});

test("a user in two teams reads both, only those, and nothing once off the beta list", async () => {
  // The policies compare each row's team with the caller's teams, looked up once a query (PERF-012).
  const a = await crewWithData();
  const b = await crewWithData();
  const other = await crewWithData();
  await addToTeam(b.team, a.user, "member");
  for (const crew of [a, b]) {
    const { data: boat, error } = await crew.user.db.from("boats").insert({ team_id: crew.team, name: "Eight" }).select("id").single();
    if (error) throw error;
    const { error: seatError } = await crew.user.db.from("seats").insert({ boat_id: boat.id, seat_number: 1 });
    if (seatError) throw seatError;
    const { error: gpsError } = await crew.user.db.from("gps_points").insert({ session_id: crew.session, t_ms: 0, lat: 51.5, lon: -0.1 });
    if (gpsError) throw gpsError;
  }

  const seen = async (table: string, column: string) =>
    ((await a.user.db.from(table).select(column)).data ?? []).map((r) => (r as unknown as Record<string, string>)[column]).sort();
  const both = (x: string, y: string) => [x, y].sort();
  expect(await seen("teams", "id")).toEqual(both(a.team, b.team));
  expect(await seen("team_members", "team_id")).toEqual([a.team, b.team, b.team].sort());
  expect(await seen("boats", "team_id")).toEqual(both(a.team, b.team));
  expect((await seen("seats", "seat_number")).length).toBe(2);
  expect(await seen("sessions", "id")).toEqual(both(a.session, b.session));
  expect(await seen("session_stats", "session_id")).toEqual(both(a.session, b.session));
  expect(await seen("gps_points", "session_id")).toEqual(both(a.session, b.session));
  expect(await seen("sessions", "id")).not.toContain(other.session);

  await revoke(a.user.email);
  for (const [table, column] of [["teams", "id"], ["team_members", "team_id"], ["boats", "id"], ["seats", "id"], ["sessions", "id"],
    ["session_stats", "session_id"], ["strokes", "session_id"], ["gps_points", "session_id"], ["session_files", "path"]]) {
    expect(await seen(table, column), table).toEqual([]);
  }
  // B's owner still reads B.
  expect(await sessionsSeenBy(b.user)).toEqual([{ id: b.session }]);
  // The helper, like is_team_member, isn't something the API exposes.
  expect((await a.user.db.rpc("my_team_ids")).error?.code).toBe("PGRST202");
});

test("the membership check can't be called through the API", async () => {
  const { user, team } = await crewWithData();
  const { error } = await user.db.rpc("is_team_member", { team });
  expect(error?.code).toBe("PGRST202"); // no such function exposed
});

test("reading strokes and tracks through the functions still keeps to your own team", async () => {
  const { user, session } = await crewWithData();
  const { error: strokeError } = await user.db.from("strokes").insert({
    session_id: session, rec: 0, seq: 1, catch_ms: 1000, drive_ms: 700, recovery_ms: 1300, peak: 50, peak_pos_pct: 40,
    impulse: 25, rise_rate: 200, third1: 8, third2: 12, third3: 5, curve_valid: true,
  });
  expect(strokeError).toBeNull();
  const { error: gpsError } = await user.db.from("gps_points").insert({ session_id: session, t_ms: 0, lat: 51.5, lon: -0.1 });
  expect(gpsError).toBeNull();

  expect((await user.db.rpc("session_strokes", { p_sessions: [session] })).data).toEqual({ [session]: [[0, 1, 1000, 700, 1300, 50, 40, 25, 200, 8, 12, 5, true]] });
  expect((await user.db.rpc("session_track", { p_session: session })).data).toEqual([[0, 51.5, -0.1, null, null]]);

  const intruder = await makeUser();
  expect((await intruder.db.rpc("session_strokes", { p_sessions: [session] })).data).toEqual({});
  expect((await intruder.db.rpc("session_track", { p_session: session })).data).toEqual([]);

  const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  expect((await anon.rpc("session_strokes", { p_sessions: [session] })).error?.code).toBe("42501");
  expect((await anon.rpc("session_track", { p_session: session })).error?.code).toBe("42501");
});

test("the publishable key on its own can't touch a dashboard table", async () => {
  const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const table of ["allowed_users", "teams", "team_members", "boats", "seats", "sessions", "session_files", "strokes", "gps_points", "session_stats"]) {
    const { error } = await anon.from(table).select("*").limit(1);
    expect(error?.code, table).toBe("42501"); // permission denied, not merely zero rows
  }
});

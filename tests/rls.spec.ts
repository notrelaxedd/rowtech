// Row-level security, checked the way an attacker would try it: straight at
// the API with the publishable key and a real user's session, no app in
// between. Runs against a local Supabase only (tests/support/local-supabase.ts).
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
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

test("the membership check can't be called through the API", async () => {
  const { user, team } = await crewWithData();
  const { error } = await user.db.rpc("is_team_member", { team });
  expect(error?.code).toBe("PGRST202"); // no such function exposed
});

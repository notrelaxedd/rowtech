"use server";

import { revalidatePath } from "next/cache";
import { getViewer, supabaseServer } from "@/lib/supabase/server";

export type SideResult = { ok: true } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FAILED: SideResult = { ok: false, message: "That side wasn't saved. Try again in a minute." };

/** Which side a seat rows. The node can't know, so the coach says once. */
export async function setSeatSide(sessionId: string, side: "port" | "starboard"): Promise<SideResult> {
  // The types above are gone at runtime; a hand-made request can send anything.
  if (!UUID.test(sessionId) || (side !== "port" && side !== "starboard")) return FAILED;
  // RLS is the real gate; this keeps a removed beta user out even if it weren't.
  if ((await getViewer()).state !== "allowed") return FAILED;

  const sb = await supabaseServer();
  const { data: session, error } = await sb.from("sessions").select("boat_id, seat_number").eq("id", sessionId).maybeSingle();
  if (error || !session) return FAILED;

  // With a boat, the side belongs to that seat of the boat and carries over to
  // its other outings. Without one, it belongs to this seat of this outing.
  const { data: saved, error: saveError } =
    session.boat_id && session.seat_number !== null
      ? await sb
          .from("seats")
          .upsert({ boat_id: session.boat_id, seat_number: session.seat_number, side }, { onConflict: "boat_id,seat_number" })
          .select("id")
      : await sb.from("sessions").update({ side }).eq("id", sessionId).select("id");
  if (saveError || !saved?.length) {
    if (saveError) console.error("seat side not saved", { code: saveError.code, message: saveError.message });
    return FAILED;
  }

  revalidatePath("/app/cox", "layout");
  return { ok: true };
}

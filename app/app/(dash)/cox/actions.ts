"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

/** Which side a seat rows. The node can't know, so the coach says once. */
export async function setSeatSide(sessionId: string, side: "port" | "starboard"): Promise<void> {
  const sb = await supabaseServer();
  const { data: session } = await sb.from("sessions").select("boat_id, seat_number").eq("id", sessionId).maybeSingle();
  if (!session?.boat_id || session.seat_number === null) return;
  await sb
    .from("seats")
    .upsert({ boat_id: session.boat_id, seat_number: session.seat_number, side }, { onConflict: "boat_id,seat_number" });
  revalidatePath(`/app/cox`);
}

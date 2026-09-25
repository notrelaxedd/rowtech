import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { readFailed, supabaseServer } from "@/lib/supabase/server";
import { duration } from "@/lib/session/analyse";
import { LocalTime } from "@/components/dash/local-time";
import { beforeParam, newestFirstPage } from "@/lib/session/older";

export const metadata = { title: "Crew outings" };

/** Most outings a page of the list shows. */
const LISTED = 100;

export default async function CoxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // ?before= pages back through older outings; a malformed one is the newest page.
  const before = beforeParam((await searchParams).before);
  const sb = await supabaseServer();
  let query = sb.from("sessions").select("id, title, recorded_at, clock_source, duration_ms, boats(name)").eq("kind", "crew");
  if (before) query = query.lt("recorded_at", before);
  const { data, error } = await query.order("recorded_at", { ascending: false }).limit(LISTED + 1);
  if (error) throw await readFailed(error);
  const { rows: crews, older } = newestFirstPage(data ?? [], LISTED);

  return (
    <div className="mx-auto w-full max-w-[110rem] space-y-8 px-4 py-8 sm:px-6">
      <div className="max-w-3xl">
        <h1 className="type-h3 text-2xl">Crew outings</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
          Outings with the whole crew in them. Upload several seats on the Sessions tab as one zip, each seat’s files
          in a folder of its own, and they land here as one outing. Vieve, the RowTech cox box, will add the GPS track and put every seat on one clock; its session format
          isn’t final yet, so the dashboard can’t read a Vieve bundle today.
        </p>
      </div>

      {crews.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-muted-foreground">
          {before ? "No older outings." : "No crew outings yet. Upload a zip with each seat’s files in a folder of its own and they become one."}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-line rounded-lg border border-line bg-panel">
            {crews.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/app/cox/${c.id}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-trace"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{c.title || "Crew outing"}</span>
                    <span className="readout block text-xs text-muted-foreground">
                      <LocalTime at={c.recorded_at} />
                      {c.boats?.name ? ` · ${c.boats.name}` : ""}
                    </span>
                  </span>
                  <span className="readout shrink-0 text-sm text-muted-foreground">
                    {c.clock_source === "gps" ? "one clock" : "seat clocks"}
                    {c.duration_ms ? ` · ${duration(c.duration_ms)}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {(older || before) && (
            <p className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {before && (
                <Link href="/app/cox" className="inline-flex items-center gap-1.5 text-trace underline-offset-4 hover:underline">
                  <ArrowLeft aria-hidden className="size-3.5" />
                  Newest outings
                </Link>
              )}
              {older && (
                <Link href={`/app/cox?before=${encodeURIComponent(older)}`} className="inline-flex items-center gap-1.5 text-trace underline-offset-4 hover:underline">
                  Older outings
                  <ArrowRight aria-hidden className="size-3.5" />
                </Link>
              )}
            </p>
          )}
          {crews.length > 1 && (
            <Link href="/app/cox/compare" className="inline-flex items-center gap-1.5 text-sm text-trace underline-offset-4 hover:underline">
              Compare two outings
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          )}
        </>
      )}
    </div>
  );
}

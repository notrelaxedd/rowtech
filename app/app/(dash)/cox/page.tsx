import Link from "next/link";
import { readFailed, supabaseServer } from "@/lib/supabase/server";
import { duration } from "@/lib/session/analyse";
import { LocalTime } from "@/components/dash/local-time";

export const metadata = { title: "Cox" };

type Row = {
  id: string;
  title: string | null;
  recorded_at: string;
  clock_source: string;
  duration_ms: number | null;
  boats: { name: string } | null;
};

export default async function CoxPage() {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("sessions")
    .select("id, title, recorded_at, clock_source, duration_ms, boats(name)")
    .eq("kind", "crew")
    .order("recorded_at", { ascending: false })
    .limit(100);
  if (error) throw readFailed(error);
  const crews = (data ?? []) as unknown as Row[];

  return (
    <div className="mx-auto w-full max-w-[110rem] space-y-8 px-4 py-8 sm:px-6">
      <div className="max-w-3xl">
        <h1 className="type-h3 text-2xl">Cox</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
          Outings with the whole crew in them. Upload several seats at once on the Force tab and they land here as one
          piece. Vieve, the RowTech cox box, will add the GPS track and put every seat on one clock; its session format
          isn&rsquo;t final yet, so the dashboard can&rsquo;t read a Vieve bundle today.
        </p>
      </div>

      {crews.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-muted-foreground">
          No crew outings yet. Upload more than one seat together and they become one.
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
          {crews.length > 1 && (
            <Link href="/app/cox/compare" className="inline-block text-sm text-trace underline-offset-4 hover:underline">
              Compare two pieces →
            </Link>
          )}
        </>
      )}
    </div>
  );
}

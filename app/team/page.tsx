import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { BetaLink } from "@/components/site/cta";
import { PhotoSlot } from "@/components/site/photo-slot";
import { TEAM } from "@/lib/team";

export const metadata: Metadata = {
  title: "Who's building RowTech",
  description: "Caden Polk, Emmett O'Donnell and Stanislav Ryskin are building RowTech. Our pilot site is Saint Edward crew.",
  alternates: { canonical: "/team" },
};

export default function TeamPage() {
  return (
    <div className="site flex min-h-full flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        <section className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <h1 className="type-h1 max-w-[14ch]">Who&rsquo;s building this.</h1>
          <ul className="mt-14 grid max-w-4xl grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 sm:gap-8">
            {TEAM.map((p) => (
              <li key={p.name}>
                <PhotoSlot label={p.name} shows={`A portrait of ${p.name}, ideally at the boathouse.`} ratio="1 / 1" />
                <p className="type-h3 mt-5">{p.name}</p>
                <p className="type-body mt-1 text-muted-foreground">{p.line}</p>
              </li>
            ))}
          </ul>
          <p className="type-h3 mt-16 border-t border-line pt-10">Our pilot site is Saint Edward crew.</p>
          <div className="mt-10">
            <BetaLink from="team" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

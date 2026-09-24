import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Seat-by-seat force measurement for rowing. In beta.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/#how" className="hover:text-foreground">How it works</Link>
          <Link href="/#stroke" className="hover:text-foreground">One stroke</Link>
          <Link href="/#vieve" className="hover:text-foreground">Vieve</Link>
          <Link href="/team" className="hover:text-foreground">Who we are</Link>
          <Link href="/#beta" className="hover:text-foreground">The beta</Link>
        </nav>
      </div>
      <div className="mx-auto max-w-7xl px-5 pb-10 text-xs text-muted-foreground sm:px-8">
        © {new Date().getFullYear()} RowTech
      </div>
    </footer>
  );
}

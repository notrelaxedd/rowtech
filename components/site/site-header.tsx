import Link from "next/link";
import { Logo } from "./logo";
import { BetaLink } from "./cta";

const links = [
  { href: "/#crew", label: "The crew view" },
  { href: "/#how", label: "How it works" },
  { href: "/#stroke", label: "One stroke" },
  { href: "/#cox-box", label: "Cox box" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="RowTech home" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-trace">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-trace"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <BetaLink from="nav" className="h-10 px-4 text-sm">
          Join the beta
        </BetaLink>
      </div>
      <div aria-hidden className="rt-progress absolute inset-x-0 -bottom-px h-px bg-trace shadow-[0_0_8px_rgb(34_227_239/0.8)]" />
    </header>
  );
}

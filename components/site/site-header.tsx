import Link from "next/link";
import { Logo } from "./logo";
import { BetaLink } from "./cta";
import { MobileMenu } from "./mobile-menu";
import { SkipLink } from "./skip-link";

const links = [
  { href: "/#how", label: "Rigger to phone" },
  { href: "/#stroke", label: "One stroke" },
  { href: "/force", label: "Force" },
  { href: "/vieve", label: "Vieve" },
  { href: "/#faq", label: "Questions" },
];

/** `cta={false}` on pages that are already the destination (/beta). */
export function SiteHeader({ cta = true }: { cta?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/95 backdrop-blur-sm">
      <SkipLink />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" aria-label="RowTech home" className="hit-area relative rounded-md">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <MobileMenu links={links} />
          {cta && <BetaLink from="nav" className="hit-area relative h-10 px-3.5 text-sm whitespace-nowrap" />}
        </div>
      </div>
    </header>
  );
}

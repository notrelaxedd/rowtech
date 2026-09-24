import Link from "next/link";
import { cn } from "@/lib/utils";

const base =
  "inline-flex h-12 items-center justify-center rounded-md px-5 text-[0.9375rem] font-semibold transition-[background-color,border-color,color] duration-200 ease-out active:translate-y-px";

/** Lane-buoy orange, and only ever on the way into the beta. */
export const ctaPrimary = cn(base, "bg-buoy text-buoy-ink hover:bg-[#ff8a3d]");
export const ctaSecondary = cn(
  base,
  "border border-foreground/25 text-foreground hover:border-foreground/50 hover:bg-foreground/[0.04]"
);

/** Every entry into the funnel says where it came from (`?from=`). */
export function BetaLink({
  from,
  children = "Apply for the beta",
  className,
}: {
  from: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={`/beta?from=${from}`} data-cta={from} className={cn(ctaPrimary, className)}>
      {children}
    </Link>
  );
}

/**
 * How a section can end: one line and, where it earns its place, a way on.
 * The beta link appears here only at the page's one mid-point ask.
 */
export function SectionEnd({
  from,
  children,
  secondary,
  apply = false,
  className,
}: {
  from: string;
  children?: React.ReactNode;
  secondary?: { href: string; label: string; from?: string };
  apply?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("mt-14 flex flex-col gap-5 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between sm:gap-8", className)}>
      {children ? <p className="type-body max-w-[52ch] text-foreground">{children}</p> : <span />}
      <div className="flex shrink-0 flex-wrap gap-3">
        {secondary && (
          <Link href={secondary.href} data-cta={secondary.from} className={cn(ctaSecondary, "max-sm:w-full")}>
            {secondary.label}
          </Link>
        )}
        {apply && <BetaLink from={from} className="max-sm:w-full" />}
      </div>
    </div>
  );
}

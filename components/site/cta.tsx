import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex h-12 items-center justify-center gap-2 rounded-md px-5 text-[0.9375rem] font-semibold transition-[background-color,border-color,color,transform] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-trace active:translate-y-px";

export const ctaPrimary = cn(
  base,
  "bg-trace text-primary-foreground hover:bg-[#7cf0f6]"
);
export const ctaSecondary = cn(
  base,
  "border border-white/14 text-foreground hover:border-white/30 hover:bg-white/[0.04]"
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
    <Link href={`/beta?from=${from}`} data-cta={from} className={cn(ctaPrimary, "group", className)}>
      {children}
      <ArrowRight
        aria-hidden
        className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
      />
    </Link>
  );
}

/** How every section ends: one reason to apply, and the way in. */
export function SectionEnd({
  from,
  children,
  secondary,
  className,
}: {
  from: string;
  children: React.ReactNode;
  secondary?: { href: string; label: string; from?: string };
  className?: string;
}) {
  return (
    <div className={cn("mt-14 flex flex-col gap-5 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between sm:gap-8", className)}>
      <p className="type-body max-w-[52ch] text-foreground">{children}</p>
      <div className="flex shrink-0 flex-wrap gap-3">
        {secondary && (
          <Link href={secondary.href} data-cta={secondary.from} className={cn(ctaSecondary, "max-sm:w-full")}>
            {secondary.label}
          </Link>
        )}
        <BetaLink from={from} className="max-sm:w-full" />
      </div>
    </div>
  );
}

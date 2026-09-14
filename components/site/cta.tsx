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
    <Link href={`/beta?from=${from}`} className={cn(ctaPrimary, "group", className)}>
      {children}
      <ArrowRight
        aria-hidden
        className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
      />
    </Link>
  );
}

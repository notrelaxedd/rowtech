import { cn } from "@/lib/utils";

/** Wordmark: one force pulse on the scope's baseline, then the name. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 28 28" aria-hidden className="size-7 shrink-0">
        <rect x="0.5" y="0.5" width="27" height="27" rx="6" fill="#0d1115" stroke="rgb(255 255 255 / 0.14)" />
        <path d="M4 20h4.5c1.6 0 2.2-12 5-12s3.2 12 5 12H24" fill="none" stroke="var(--trace)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[1.0625rem] font-extrabold tracking-[-0.01em] [font-stretch:118%]">RowTech</span>
    </span>
  );
}

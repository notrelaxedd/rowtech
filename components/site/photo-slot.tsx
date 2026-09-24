import { cn } from "@/lib/utils";

/**
 * A marked place for a real photograph. No stock and no generated images:
 * each slot says exactly what the shot should show, so it can be taken at the
 * boathouse and dropped in. Replace the slot with a next/image once the photo
 * exists.
 */
export function PhotoSlot({
  label,
  shows,
  ratio = "3 / 2",
  className,
}: {
  /** What goes after "PHOTO:" in the marker, e.g. "node on backstay". */
  label: string;
  /** One line on what the photo needs to show. */
  shows: string;
  ratio?: string;
  className?: string;
}) {
  return (
    <figure className={cn("m-0", className)}>
      <div
        role="img"
        aria-label={`Photo to come: ${label}. ${shows}`}
        style={{ aspectRatio: ratio }}
        className="flex w-full flex-col justify-end rounded-md border border-dashed border-foreground/30 bg-[repeating-linear-gradient(135deg,transparent_0_11px,rgb(29_35_39/0.05)_11px_12px)] p-4"
      >
        <p className="text-sm font-semibold text-foreground">[PHOTO: {label}]</p>
        <p className="mt-1 max-w-[40ch] text-sm text-muted-foreground">{shows}</p>
      </div>
    </figure>
  );
}

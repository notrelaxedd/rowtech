import { SCREEN, mono } from "./screen-theme";

/**
 * Holds a device drawing's exact box until the drawing itself arrives.
 *
 * The drawings are several hundred SVG elements each. Below the fold they are
 * loaded as islands, so the page doesn't parse and hydrate them before anyone
 * has scrolled to them; this stands in until then, at the same aspect ratio,
 * so nothing moves when it is replaced. Without JavaScript it is what stays,
 * and the section's words carry the meaning on their own.
 */
export function DevicePlaceholder({ ratio, name }: { ratio: number; name: string }) {
  return (
    <div
      aria-hidden
      style={{ aspectRatio: String(ratio) }}
      className="flex w-full items-center justify-center rounded-[2.5%] border border-white/[0.06] bg-[#191e22]"
    >
      <span style={{ color: SCREEN.label, fontFamily: mono, letterSpacing: "0.6em" }} className="text-xs sm:text-sm">
        {name}
      </span>
    </div>
  );
}

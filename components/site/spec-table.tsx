import type { Spec } from "@/lib/specs";

/** A product's specifications, as a plain two-column list. */
export function SpecTable({ specs, note }: { specs: readonly Spec[]; note?: string }) {
  return (
    <div>
      <dl className="divide-y divide-line border-y border-line">
        {specs.map(([k, v]) => (
          <div key={k} className="grid grid-cols-1 gap-1 py-4 sm:grid-cols-[11rem_1fr] sm:gap-8">
            <dt className="text-sm font-semibold text-muted-foreground">{k}</dt>
            <dd className="text-[0.9375rem] leading-relaxed">{v}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-4 text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}

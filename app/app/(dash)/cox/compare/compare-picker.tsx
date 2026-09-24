"use client";

import { useId } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { InlineScript, scriptValue } from "@/components/dash/local-time";

/** "Title · date", with the date in the viewer's zone and locale. */
const optionText = (label: string, at: string) => `${label} · ${new Date(at).toLocaleDateString()}`;

/** Which two pieces to lay side by side. Kept in the URL, so it can be shared. */
export function ComparePicker({
  crews,
  a,
  b,
}: {
  crews: Array<{ id: string; label: string; at: string }>;
  a?: string;
  b?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const selectId = useId();

  const pick = (which: "a" | "b", id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(which, id);
    router.replace(`/app/cox/compare?${next.toString()}`);
  };

  // The server can only write dates in its own zone; as with LocalTime, an
  // inline script rewrites them before the page paints.
  const select = (which: "a" | "b", value?: string) => (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      {which === "a" ? "First" : "Second"}
      <select
        id={`${selectId}${which}`}
        value={value ?? ""}
        onChange={(e) => pick(which, e.target.value)}
        className="min-h-9 max-w-[22rem] rounded-md border border-line bg-[#0b0e11] px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace"
      >
        <option value="">none</option>
        {crews.map((c) => (
          <option key={c.id} value={c.id} data-label={c.label} data-at={c.at} suppressHydrationWarning>
            {optionText(c.label, c.at)}
          </option>
        ))}
      </select>
      <InlineScript
        html={`{var s=document.getElementById(${scriptValue(`${selectId}${which}`)});if(s)for(var i=0;i<s.options.length;i++){var o=s.options[i];if(o.dataset.at)o.textContent=o.dataset.label+" · "+new Date(o.dataset.at).toLocaleDateString()}}`}
      />
    </label>
  );

  return (
    <div className="flex flex-wrap items-center gap-4">
      {select("a", a)}
      {select("b", b)}
    </div>
  );
}

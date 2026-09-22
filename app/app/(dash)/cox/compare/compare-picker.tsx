"use client";

import { useRouter, useSearchParams } from "next/navigation";

/** Which two pieces to lay side by side. Kept in the URL, so it can be shared. */
export function ComparePicker({
  crews,
  a,
  b,
}: {
  crews: Array<{ id: string; label: string }>;
  a?: string;
  b?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const pick = (which: "a" | "b", id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(which, id);
    router.replace(`/app/cox/compare?${next.toString()}`);
  };

  const select = (which: "a" | "b", value?: string) => (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      {which === "a" ? "First" : "Second"}
      <select
        value={value ?? ""}
        onChange={(e) => pick(which, e.target.value)}
        className="min-h-9 max-w-[22rem] rounded-md border border-line bg-[#0b0e11] px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace"
      >
        <option value="">none</option>
        {crews.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-wrap items-center gap-4">
      {select("a", a)}
      {select("b", b)}
    </div>
  );
}

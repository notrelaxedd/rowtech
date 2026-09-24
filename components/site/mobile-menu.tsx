"use client";

import Link from "next/link";
import { useRef } from "react";

/** Phones: the header links behind a native disclosure that closes on a pick. */
export function MobileMenu({ links }: { links: ReadonlyArray<{ href: string; label: string }> }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => ref.current?.removeAttribute("open");
  return (
    <details ref={ref} className="relative lg:hidden">
      <summary className="flex h-10 cursor-pointer list-none items-center rounded-md px-2.5 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        Menu
      </summary>
      <nav
        aria-label="Primary"
        className="absolute right-0 top-12 z-50 w-56 rounded-md border border-line bg-popover p-1.5 shadow-[0_12px_32px_rgb(29_35_39/0.18)]"
      >
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={close}
            className="flex min-h-11 items-center rounded px-3 text-[0.9375rem] text-foreground hover:bg-foreground/[0.05]"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </details>
  );
}

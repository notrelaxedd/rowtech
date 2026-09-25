"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/**
 * Phones: the header links behind a native disclosure, which opens and closes
 * without JavaScript. With it, the menu also closes on a pick, on Escape (focus
 * back on "Menu"), on a tap outside it, when the page scrolls, and when focus
 * moves out of it, and "Menu" says whether it's open.
 */
export function MobileMenu({ links }: { links: ReadonlyArray<{ href: string; label: string }> }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const navId = useId();
  const [open, setOpen] = useState(false);
  // Before hydration the <summary> reports its own state; after, it's ours.
  const js = useSyncExternalStore(noSubscribe, () => true, () => false);

  useEffect(() => {
    const d = ref.current;
    if (!open || !d) return;
    // Focus left inside a closed menu is on nothing visible: bring it back.
    const close = (refocus: boolean) => {
      const focused = d.contains(document.activeElement) && document.activeElement !== trigger.current;
      d.open = false;
      if (refocus || focused) trigger.current?.focus({ preventScroll: true });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const onPointer = (e: PointerEvent) => {
      if (!d.contains(e.target as Node)) close(false);
    };
    // A scroll event already on its way when the menu opened isn't one.
    const y = window.scrollY;
    const onScroll = () => {
      if (window.scrollY !== y) close(false);
    };
    const onFocusOut = (e: FocusEvent) => {
      // null: the window lost focus, or a tap on nothing (handled above).
      if (e.relatedTarget && !d.contains(e.relatedTarget as Node)) d.open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", onScroll, { passive: true });
    d.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll);
      d.removeEventListener("focusout", onFocusOut);
    };
  }, [open]);

  return (
    // Not positioned itself: the panel hangs from the header, inside the screen.
    <details ref={ref} className="lg:hidden" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary
        ref={trigger}
        aria-expanded={js ? open : undefined}
        aria-controls={js ? navId : undefined}
        className="flex h-10 cursor-pointer list-none items-center rounded-md px-2.5 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden"
      >
        Menu
      </summary>
      <nav
        id={navId}
        aria-label="Primary"
        className="absolute top-15 right-4 z-50 w-56 max-w-[calc(100vw-2rem)] rounded-md border border-line bg-popover p-1.5 shadow-[0_12px_32px_rgb(0_0_0/0.45)] sm:right-8"
      >
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => ref.current?.removeAttribute("open")}
            className="flex min-h-11 items-center rounded px-3 text-[0.9375rem] text-foreground hover:bg-foreground/[0.05]"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </details>
  );
}

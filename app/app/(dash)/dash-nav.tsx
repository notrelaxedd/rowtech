"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/app/force", label: "Force" },
  { href: "/app/cox", label: "Cox" },
];

export function DashNav() {
  const path = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex items-center gap-1">
      {TABS.map((t) => {
        const on = path === t.href || path.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace",
              on ? "bg-white/[0.07] text-trace" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

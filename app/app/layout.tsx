import type { Metadata, Viewport } from "next";
import { titleTemplate } from "@/lib/site";

// Everything under /app is private: never indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: { default: "Dashboard", template: titleTemplate },
};

// The dashboard's background, not the site's river (globals.css).
export const viewport: Viewport = { themeColor: "#07090b" };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children;
}

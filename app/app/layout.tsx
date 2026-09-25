import type { Metadata } from "next";
import { titleTemplate } from "@/lib/site";

// Everything under /app is private: never indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: { default: "Dashboard", template: titleTemplate },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children;
}

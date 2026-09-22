import type { Metadata } from "next";

// Everything under /app is private: never indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: { default: "Dashboard", template: "%s · RowTech" },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children;
}

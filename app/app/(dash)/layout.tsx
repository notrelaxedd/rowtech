import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";
import { Logo } from "@/components/site/logo";
import { signOut } from "../login/actions";
import { RequestAccess } from "./request-access";
import { DashNav } from "./dash-nav";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (viewer.state === "signed-out") redirect("/app/login");
  if (viewer.state === "not-allowed") return <RequestAccess email={viewer.email} signOut={signOut} />;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[110rem] items-center gap-6 px-4 sm:px-6">
          <Link href="/app" aria-label="RowTech dashboard" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-trace">
            <Logo />
          </Link>
          <DashNav />
          <div className="ml-auto flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:inline">{viewer.email}</span>
            <form action={signOut}>
              <button type="submit" className="min-h-9 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}

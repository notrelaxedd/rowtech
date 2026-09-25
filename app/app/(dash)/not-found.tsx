import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// notFound() from a dashboard page: shown inside the dashboard, not as the
// site's 404. RLS makes another team's session look exactly like no session.
export default function DashNotFound() {
  return (
    <div className="mx-auto w-full max-w-[110rem] px-4 py-8 sm:px-6">
      <Link href="/app/force" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft aria-hidden className="size-3.5" />
        Sessions
      </Link>
      <h1 className="type-h3 mt-3 text-2xl">Nothing here.</h1>
      <p className="mt-3 max-w-3xl text-[0.9375rem] leading-relaxed text-muted-foreground">
        There’s no session at this address, or it isn’t one your team can see.
      </p>
    </div>
  );
}

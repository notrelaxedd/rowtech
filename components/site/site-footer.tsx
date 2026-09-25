import Link from "next/link";
import { ContactEmail } from "./legal";
import { Logo } from "./logo";

const link = "hit-area relative hover:text-foreground";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Seat-by-seat force measurement for rowing. In beta.
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Questions? Write to <ContactEmail />.
          </p>
        </div>
        {/* Each link takes taps over 44px, drawn (and focus-ringed) at its
            text's size; rows sit far enough apart for those not to overlap. */}
        <nav aria-label="Footer" className="flex flex-wrap gap-6 text-sm text-muted-foreground">
          <Link href="/#how" className={link}>Rigger to phone</Link>
          <Link href="/force" className={link}>Force</Link>
          <Link href="/force#specs" className={link}>Force specifications</Link>
          <Link href="/vieve" className={link}>Vieve</Link>
          <Link href="/vieve#specs" className={link}>Vieve specifications</Link>
          <Link href="/#beta" className={link}>Tell us about your crew</Link>
          <Link href="/privacy" className={link}>Privacy</Link>
          <Link href="/terms" className={link}>Terms</Link>
          <Link href="/accessibility" className={link}>Accessibility</Link>
          <Link href="/licenses" className={link}>Open-source licenses</Link>
        </nav>
      </div>
      <div className="mx-auto max-w-7xl px-5 pb-10 text-xs text-muted-foreground sm:px-8">
        © {new Date().getFullYear()} RowTech
      </div>
    </footer>
  );
}

import Link from "next/link";
import { contactEmail, contactIsEmail } from "@/lib/owner";

/** A link inside a sentence: underlined, not only coloured (A11Y-002). */
export const inlineLink = "text-trace underline underline-offset-4";

/** "See Privacy and Terms.", for under a form that takes someone's details. */
export function PolicyLinks() {
  return (
    <>
      See{" "}
      <Link href="/privacy" className={inlineLink}>
        Privacy
      </Link>{" "}
      and{" "}
      <Link href="/terms" className={inlineLink}>
        Terms
      </Link>
      .
    </>
  );
}

/** One part of /privacy or /terms: a heading, then its paragraphs and lists. */
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-6">
      <h2 className="type-h3">{title}</h2>
      <div className="type-body mt-4 space-y-4 text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">{children}</div>
    </section>
  );
}

/** Where to write: a mailto link once lib/owner.ts holds a real address. */
export function ContactEmail() {
  return contactIsEmail ? (
    <a href={`mailto:${contactEmail}`} className={inlineLink}>
      {contactEmail}
    </a>
  ) : (
    <>{contactEmail}</>
  );
}

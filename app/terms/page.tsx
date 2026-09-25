import type { Metadata } from "next";
import Link from "next/link";
import { SitePage, wrap } from "@/components/site/site-page";
import { ContactEmail, inlineLink, LegalSection } from "@/components/site/legal";
import { legalCountry, legalEntity } from "@/lib/owner";
import { pageMetadata } from "@/lib/site";

// The terms themselves are the owners' to write: each is an OWNER
// placeholder in the page body, never in the metadata.
export const metadata: Metadata = pageMetadata({
  title: "Terms",
  description: "The terms for RowTech beta crews and for using the RowTech dashboard.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <SitePage>
      <div className={wrap}>
        <div className="max-w-3xl pt-20 pb-24 sm:pt-28 sm:pb-28">
          <h1 className="type-h1">Terms.</h1>
          <p className="type-lead mt-6 text-muted-foreground">
            The terms for taking part in the RowTech beta, and for using the RowTech dashboard.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">Last updated: [OWNER: the date these terms take effect]</p>

          <div className="mt-14 space-y-12">
            <LegalSection title="Who runs RowTech">
              <p>
                RowTech is run by {legalEntity}, {legalCountry}.
              </p>
              <p>
                Questions about these terms go to <ContactEmail />.
              </p>
            </LegalSection>

            <LegalSection title="The beta">
              <p>[OWNER: who can take part in the beta, how crews are chosen, and how long the beta runs]</p>
              <p>
                [OWNER: what &ldquo;Testing units, for now&rdquo; means: whether units are lent or given, who owns them,
                when they go back, and who is responsible for loss, damage or injury while one is in use]
              </p>
              <p>[OWNER: what beta crews are asked to do in return, if anything]</p>
            </LegalSection>

            <LegalSection title="Using the dashboard">
              <p>The dashboard is for beta crews: an account works only while its email address is on the beta list.</p>
              <p>[OWNER: acceptable use: what may and may not be uploaded to, or done with, the dashboard]</p>
              <p>
                [OWNER: what a coach must have from their rowers (or the rowers&rsquo; parents) before uploading data about
                them]
              </p>
            </LegalSection>

            <LegalSection title="Your data">
              <p>
                What&rsquo;s collected and where it&rsquo;s kept is on the{" "}
                <Link href="/privacy" className={inlineLink}>
                  Privacy
                </Link>{" "}
                page.
              </p>
              <p>[OWNER: who owns uploaded session data, and what RowTech may do with it]</p>
            </LegalSection>

            <LegalSection title="Liability">
              <p>[OWNER: warranties, and the limits of RowTech&rsquo;s liability, including for a testing unit used on the water]</p>
            </LegalSection>

            <LegalSection title="Governing law">
              <p>[OWNER: which country&rsquo;s or state&rsquo;s law governs these terms, and where disputes are settled]</p>
            </LegalSection>

            <LegalSection title="Changes">
              <p>[OWNER: how these terms can change, how beta crews and users are told, and how either side can end them]</p>
            </LegalSection>
          </div>
        </div>
      </div>
    </SitePage>
  );
}

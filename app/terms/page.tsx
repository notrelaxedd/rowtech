import type { Metadata } from "next";
import Link from "next/link";
import { SitePage, wrap } from "@/components/site/site-page";
import { ContactEmail, inlineLink, LegalSection } from "@/components/site/legal";
import { legalCountry, legalEntity, policiesUpdated } from "@/lib/owner";
import { pageMetadata } from "@/lib/site";

// The terms, from the owner's answers. Change the date in lib/owner.ts with
// every change here.
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
          <p className="mt-4 text-sm text-muted-foreground">Last updated: {policiesUpdated}</p>

          <div className="mt-14 space-y-12">
            <LegalSection title="Who runs RowTech">
              <p>
                RowTech is run by {legalEntity}, based in {legalCountry}.
              </p>
              <p>
                Questions about these terms go to <ContactEmail />.
              </p>
            </LegalSection>

            <LegalSection title="The beta">
              <p>
                Any crew, club, school or individual rower can apply. We choose who takes part, and we get in touch with
                applicants to discuss next steps.
              </p>
              <p>
                Beta crews can buy testing units at the cost of their materials. A unit you buy is yours: keep it, or
                send it back for a discount on the finished product. If a unit fails during the beta, send it back and
                we’ll replace it.
              </p>
              <p>
                You’re responsible for your units once you have them, including mounting them on your boats and using
                them safely (see Liability).
              </p>
            </LegalSection>

            <LegalSection title="Using the dashboard">
              <p>The dashboard is for beta crews: an account works only while its email address is on the beta list.</p>
              <p>
                Upload only rowing data: the session files from your nodes. Don’t put rowers’ names or other personal
                details in session names, boat names or anywhere else in the dashboard. Before you upload a crew’s
                sessions, let the rowers know, and for rowers under 18, their parents or guardians too.
              </p>
              <p>When you use the dashboard, don’t:</p>
              <ul>
                <li>upload anything you don’t have the right to upload;</li>
                <li>
                  try to reach another team’s data, get around sign-in or the dashboard’s limits, or interfere with how
                  it runs;
                </li>
                <li>share your sign-in links, or let someone else use your account.</li>
              </ul>
              <p>We can suspend or close an account that breaks these rules.</p>
            </LegalSection>

            <LegalSection title="Your data">
              <p>
                What’s collected and where it’s kept is on the{" "}
                <Link href="/privacy" className={inlineLink}>
                  Privacy
                </Link>{" "}
                page.
              </p>
              <p>
                You own the data you upload. You let RowTech store it and analyze it, only to show it to you and your
                team in the dashboard. Your team’s owners and coaches can delete sessions themselves, and you can ask
                us to delete your data (see Privacy).
              </p>
            </LegalSection>

            <LegalSection title="Liability">
              <p>
                The beta, the testing units and the dashboard are provided “as is”, without warranties of any kind,
                except that we replace a unit that fails during the beta. Rowing, and mounting equipment on a boat,
                carry their own risks, and you use testing units at your own risk.
              </p>
              <p>
                To the fullest extent the law allows, RowTech and {legalEntity} aren’t liable for any loss, damage or
                injury that comes from taking part in the beta, or from using a testing unit or the dashboard.
              </p>
            </LegalSection>

            <LegalSection title="Governing law">
              <p>
                These terms are governed by the laws of the State of Ohio, United States. Any dispute about them will be
                settled in the state or federal courts in Ohio.
              </p>
            </LegalSection>

            <LegalSection title="Changes">
              <p>
                RowTech can change these terms at any time. When we do, we’ll change the date at the top of this page
                and tell dashboard users in the dashboard. Using the beta or the dashboard after a change means you
                accept the new terms.
              </p>
              <p>
                You can stop taking part at any time, and ask us to close your account (see Privacy). RowTech can
                suspend or end anyone’s access to the beta or the dashboard at any time.
              </p>
            </LegalSection>
          </div>
        </div>
      </div>
    </SitePage>
  );
}

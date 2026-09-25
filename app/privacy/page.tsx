import type { Metadata } from "next";
import Link from "next/link";
import { SitePage, wrap } from "@/components/site/site-page";
import { ContactEmail, inlineLink, LegalSection } from "@/components/site/legal";
import { legalCountry, legalEntity } from "@/lib/owner";
import { pageMetadata } from "@/lib/site";

// What the code collects, and where it sends it. Anything only the owners can
// say (who is responsible, retention, legal basis, rights, transfers, age) is
// an OWNER placeholder in the page body, never in the metadata.
export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description: "What the RowTech site, beta form and dashboard collect, where it is stored, and which services handle it.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <SitePage>
      <div className={wrap}>
        <div className="max-w-3xl pt-20 pb-24 sm:pt-28 sm:pb-28">
          <h1 className="type-h1">Privacy.</h1>
          <p className="type-lead mt-6 text-muted-foreground">
            What this site and the RowTech dashboard collect, where it’s kept, and which services handle it.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">Last updated: [OWNER: the date this privacy policy takes effect]</p>

          <div className="mt-14 space-y-12">
            <LegalSection title="Who runs RowTech">
              <p>
                RowTech is run by {legalEntity}, {legalCountry}.
              </p>
              <p>
                For anything on this page, write to <ContactEmail />.
              </p>
            </LegalSection>

            <LegalSection title="Applying for the beta">
              <p>
                The form on the{" "}
                <Link href="/beta" className={inlineLink}>
                  apply page
                </Link>{" "}
                asks for:
              </p>
              <ul>
                <li>your name, your email address, and your club, school or program;</li>
                <li>
                  if you add them: whether you’re a coach, a club or program, an athlete or something else; the boats
                  you row; where you row; and your message.
                </li>
              </ul>
              <p>It also sends which link brought you here:</p>
              <ul>
                <li>which of this site’s beta links you used, or the from tag on a link to the form;</li>
                <li>
                  if the link you first came to the site on had them, its utm_source, utm_medium, utm_campaign, utm_term and
                  utm_content tags (a ref tag counts as utm_source);
                </li>
                <li>if another website linked you here, that website’s domain: not the page, just the domain.</li>
              </ul>
              <p>
                All of it is stored with your application in RowTech’s database, on Supabase. We use this to talk to
                you about the beta, and we note which link brought you here.
              </p>
              <p>
                Once an email address has applied, applying again with it doesn’t change or add to the application
                we have.
              </p>
            </LegalSection>

            <LegalSection title="Signing in">
              <p>
                The dashboard is for beta crews. Typing an email address into the sign-in form never makes an account.
              </p>
              <p>
                An account holds its email address. Sign-in runs on Supabase Auth, which keeps the account and sends the
                sign-in links. Signing in sets Supabase’s sign-in cookies on this site; they keep you signed in to the
                dashboard, and nothing else uses them.
              </p>
              <p>
                If you choose Continue with Google, you sign in on Google’s own page, and Google tells Supabase which
                Google account you used, including its email address. Supabase keeps what Google sends with your account.
                Google isn’t involved when you sign in with an emailed link.
              </p>
            </LegalSection>

            <LegalSection title="The dashboard">
              <p>From a Force node’s session files, the dashboard keeps:</p>
              <ul>
                <li>the files themselves (meta.json, strokes.csv, curves.bin and events.csv), in Supabase Storage;</li>
                <li>each stroke’s force and timing figures, in the Supabase database;</li>
                <li>the seat number, the node’s ID and the session’s ID, from meta.json;</li>
                <li>when the session was rowed, and the boat’s name and a name for the session if you give them;</li>
                <li>which side each seat rows, if you set it.</li>
              </ul>
              <p>
                If you aren’t on a team yet, your first upload makes one, named “My crew”. Teams
                made earlier were named after the part of the owner’s email address before the @. Everyone on
                a team can see everything uploaded to it.
              </p>
              <p>
                The dashboard has a place for a GPS track of each outing, which will come from Vieve, the RowTech cox box.
                Vieve is in development, and nothing uploads a track today.
              </p>
              <p>
                Session data describes the rowers in each seat, who may never use the dashboard themselves. [OWNER: what
                coaches must tell their rowers (or the rowers’ parents) before uploading data about them, and how a
                rower can ask for that data to be removed]
              </p>
            </LegalSection>

            <LegalSection title="On every page">
              <p>Vercel hosts the site and the dashboard, so every visit to them goes through Vercel.</p>
              <p>
                Every page, on the site and in the dashboard, also runs Vercel Web Analytics and Vercel Speed Insights,
                which send information about each page visit, including which page it was, to Vercel.
              </p>
              <p>[OWNER: confirm what Vercel Web Analytics and Speed Insights collect]</p>
              <p>For the beta form, the site keeps two small notes in your browser:</p>
              <ul>
                <li>
                  in this tab’s session storage (rt_attr): the utm tags of the link you came in on, and the domain of
                  the website that sent you, if one did. It goes when the tab is closed.
                </li>
                <li>
                  in local storage (rt_cta): which of this site’s beta links you last used. The apply page reads it
                  and removes it when it opens, unless the link to it had a from tag of its own, and uses it only if
                  it’s less than five minutes old. Until then it stays in your browser.
                </li>
              </ul>
              <p>
                Neither note leaves your browser unless you send the beta form. The utm tags are also part of the address
                of the page you came in on, which goes through Vercel like any other visit.
              </p>
            </LegalSection>

            <LegalSection title="Who handles it">
              <ul>
                <li>Supabase: the database, sign-in and file storage behind everything above.</li>
                <li>Vercel: hosting, Web Analytics and Speed Insights.</li>
                <li>Google: sign-in, only for people who choose Continue with Google.</li>
              </ul>
              <p>[OWNER: confirm this list is complete, and name any other service that receives this information]</p>
              <p>
                [OWNER: where Supabase and Vercel store and process this information (country or region), and what
                protects it when it moves between countries]
              </p>
            </LegalSection>

            <LegalSection title="How long it’s kept">
              <p>
                [OWNER: how long beta applications, dashboard accounts, uploaded sessions, and Vercel’s analytics and
                logs are kept]
              </p>
            </LegalSection>

            <LegalSection title="Why we use it">
              <p>[OWNER: the legal basis for each use of information above, for people in the UK and the EU]</p>
            </LegalSection>

            <LegalSection title="Your requests">
              <p>A team’s owners and coaches can delete a session themselves, from the session’s page in the dashboard.</p>
              <p>
                [OWNER: which requests people can make about their information (for example to see, correct, export or
                delete it, to withdraw a beta application, or to close a dashboard account), how to make them, and how
                quickly they are answered]
              </p>
            </LegalSection>

            <LegalSection title="Children">
              <p>
                [OWNER: the minimum age to apply for the beta or to use the dashboard, and how information about rowers under
                18 is handled]
              </p>
            </LegalSection>

            <LegalSection title="The terms">
              <p>
                The terms for beta crews and for the dashboard are on the{" "}
                <Link href="/terms" className={inlineLink}>
                  Terms
                </Link>{" "}
                page.
              </p>
            </LegalSection>
          </div>
        </div>
      </div>
    </SitePage>
  );
}

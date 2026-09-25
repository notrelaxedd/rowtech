import type { Metadata } from "next";
import Link from "next/link";
import { SitePage, wrap } from "@/components/site/site-page";
import { ContactEmail, inlineLink, LegalSection } from "@/components/site/legal";
import { legalCountry, legalEntity, policiesUpdated } from "@/lib/owner";
import { pageMetadata } from "@/lib/site";

// What the code collects, and where it sends it. The owner's answers (who runs
// RowTech, retention, requests, age) and what Vercel and Supabase publish about
// their own services fill the rest. Keep it true to the code: when the code
// starts collecting something new or sending it somewhere new, say so here.
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
          <p className="mt-4 text-sm text-muted-foreground">Last updated: {policiesUpdated}</p>

          <div className="mt-14 space-y-12">
            <LegalSection title="Who runs RowTech">
              <p>
                RowTech is run by {legalEntity}, based in {legalCountry}.
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
                The dashboard also keeps which account uploaded each session, and who is on each team and in what
                role: owner, coach or member.
              </p>
              <p>
                The dashboard has a place for a GPS track of each outing, which will come from Vieve, the RowTech cox box.
                Vieve is in development, and nothing uploads a track today.
              </p>
              <p>
                Session data describes the rowers in each seat, who may never use the dashboard themselves. So upload
                only the node’s session files, and don’t put rowers’ names or other personal details in session or
                boat names (see the{" "}
                <Link href="/terms" className={inlineLink}>
                  Terms
                </Link>
                ). Before you upload a crew’s sessions, let the rowers know, and for rowers under 18, their parents or
                guardians too.
              </p>
              <p>
                A rower, or a rower’s parent or guardian, can ask their coach to delete a session from the dashboard,
                or write to us and we’ll delete it.
              </p>
            </LegalSection>

            <LegalSection title="On every page">
              <p>Vercel hosts the site and the dashboard, so every visit to them goes through Vercel.</p>
              <p>
                Every page, on the site and in the dashboard, also runs Vercel Web Analytics and Vercel Speed Insights,
                which send information about each page visit, including which page it was, to Vercel.
              </p>
              <p>
                Vercel says neither uses cookies or identifies you. Web Analytics records the page’s address, the
                site that linked you there, your approximate location (country, region and city), and your browser,
                operating system and type of device. It tells visits apart with a code made from each request, and
                discards that after 24 hours. Speed Insights records the page, how fast it loaded, your network speed,
                browser, operating system, type of device and country. Vercel’s own pages on{" "}
                <a href="https://vercel.com/docs/analytics/privacy-policy" className={inlineLink}>
                  Web Analytics
                </a>{" "}
                and{" "}
                <a href="https://vercel.com/docs/speed-insights/privacy-policy" className={inlineLink}>
                  Speed Insights
                </a>{" "}
                have the details.
              </p>
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
              <p>
                That’s the whole list. The site’s fonts come from this site, and the dashboard’s map draws only your
                outing’s track, with no map tiles from anyone else.
              </p>
              <p>
                It’s all stored and processed in the United States: Supabase keeps it in its us-east-1 region
                (Northern Virginia), and Vercel runs the site in its Washington, D.C. region. If you’re outside the
                United States, your information goes there. Everything between your browser, Vercel and Supabase
                travels encrypted over HTTPS, and Supabase encrypts what it stores.
              </p>
            </LegalSection>

            <LegalSection title="How long it’s kept">
              <p>
                Nothing is deleted automatically. Beta applications, dashboard accounts and uploaded sessions are
                kept until they’re deleted: a team’s owners and coaches can delete sessions themselves, and we delete
                anything you ask us to (see Your requests). Vercel keeps its analytics under its own rules.
              </p>
            </LegalSection>

            <LegalSection title="Why we use it">
              <p>For people in the UK and the EU, the legal basis for each use is:</p>
              <ul>
                <li>
                  your beta application: our legitimate interest, and yours, in replying to you and running the beta
                  you asked to join;
                </li>
                <li>your dashboard account and what you upload: providing the dashboard you signed up to use;</li>
                <li>
                  which link brought you here, and Vercel’s analytics: our legitimate interest in knowing how people
                  find the site and how well it works, using information that doesn’t identify you;
                </li>
                <li>the sign-in cookies: they’re needed to keep you signed in.</li>
              </ul>
            </LegalSection>

            <LegalSection title="Your requests">
              <p>A team’s owners and coaches can delete a session themselves, from the session’s page in the dashboard.</p>
              <p>
                You can ask us to show you, correct, export or delete the information we hold about you, to withdraw
                your beta application, or to close your dashboard account. Write to <ContactEmail /> from the email
                address you used with us, so we know the request is yours. We’ll reply within 30 days.
              </p>
              <p>If you’re in the UK or the EU, you can also complain to your data protection authority.</p>
            </LegalSection>

            <LegalSection title="Children">
              <p>
                Rowers under 18 can apply for the beta. The site and the dashboard aren’t meant for children under
                13, and we don’t knowingly collect personal information from them: a rower under 13 should ask their
                coach to apply instead. If you think we have information from a child under 13, write to us and we’ll
                delete it.
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

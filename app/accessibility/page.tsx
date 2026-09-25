import type { Metadata } from "next";
import { SitePage, wrap } from "@/components/site/site-page";
import { ContactEmail, LegalSection } from "@/components/site/legal";
import { pageMetadata } from "@/lib/site";

// What the code does for accessibility, the standard RowTech aims for, and
// where to write. Keep "What the site does" true to the code.
export const metadata: Metadata = pageMetadata({
  title: "Accessibility",
  description: "What the RowTech site and dashboard do for accessibility, and where to report a problem.",
  path: "/accessibility",
});

export default function AccessibilityPage() {
  return (
    <SitePage>
      <div className={wrap}>
        <div className="max-w-3xl pt-20 pb-24 sm:pt-28 sm:pb-28">
          <h1 className="type-h1">Accessibility.</h1>
          <p className="type-lead mt-6 text-muted-foreground">
            What this site and the RowTech dashboard do for accessibility, and where to write when something
            doesn’t work for you.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">Last updated: September 24, 2026</p>

          <div className="mt-14 space-y-12">
            <LegalSection title="What we aim for">
              <p>
                We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.1 at level AA, on the site and in the
                dashboard. We haven’t had a formal audit against them yet, so some parts may still fall short, such as
                the smallest labels in the drawings.
              </p>
            </LegalSection>

            <LegalSection title="What the site does">
              <ul>
                <li>
                  Pages with a header, on the site and in the dashboard, start with a Skip to content link. The
                  first Tab on a page shows it, and it takes you past the header to the page’s content.
                </li>
                <li>
                  On a phone, the site’s Menu opens and closes with a keyboard as well as by touch, and works
                  without JavaScript. Escape closes it and puts focus back on Menu.
                </li>
                <li>
                  The 3D models of Force and Vieve load when you reach for one: point at it or its notes, tab to a
                  note, tap it, or choose Show the 3D model. Once one is shown, it turns with the arrow keys as well as
                  by dragging.
                </li>
                <li>
                  If your device is set to reduce motion, the force curves and the Force screen are drawn still,
                  and the 3D models turn without easing.
                </li>
              </ul>
            </LegalSection>

            <LegalSection title="Reporting a problem">
              <p>
                If something on the site or in the dashboard doesn’t work for you, write to <ContactEmail />.
              </p>
              <p>We’ll reply within 3 to 5 business days and tell you what we’ll do about it.</p>
            </LegalSection>
          </div>
        </div>
      </div>
    </SitePage>
  );
}

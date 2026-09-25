import type { Metadata } from "next";
import { SitePage, wrap } from "@/components/site/site-page";
import { ContactEmail, LegalSection } from "@/components/site/legal";
import { pageMetadata } from "@/lib/site";

// What the code does for accessibility, and where to write. The standard
// RowTech aims for is the owners' to state: an OWNER placeholder in the page
// body, never in the metadata.
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
          <p className="mt-4 text-sm text-muted-foreground">Last updated: [OWNER: the date this statement was written]</p>

          <div className="mt-14 space-y-12">
            <LegalSection title="What we aim for">
              <p>
                [OWNER: the accessibility standard RowTech aims to meet (for example WCAG 2.1 AA), and how far the site
                and dashboard meet it today]
              </p>
            </LegalSection>

            <LegalSection title="What the site does">
              <ul>
                <li>
                  The site’s and the dashboard’s pages start with a Skip to content link. The first Tab on a
                  page shows it, and it takes you past the header to the page’s content.
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
                  If your device is set to reduce motion, the site’s animations stop: the force curves and the
                  Force screen are drawn still, and the 3D models turn without easing.
                </li>
              </ul>
            </LegalSection>

            <LegalSection title="Reporting a problem">
              <p>
                If something on the site or in the dashboard doesn’t work for you, write to <ContactEmail />.
              </p>
              <p>[OWNER: what happens after someone reports a problem, and how soon they hear back]</p>
            </LegalSection>
          </div>
        </div>
      </div>
    </SitePage>
  );
}

import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

/** The marketing pages' content column. */
export const wrap = "mx-auto w-full max-w-7xl px-5 sm:px-8";

/** The marketing pages' frame: the dark site theme, header and footer. */
export function SitePage({ children, jsonLd }: { children: React.ReactNode; jsonLd?: object }) {
  return (
    <div className="site flex min-h-full flex-col">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

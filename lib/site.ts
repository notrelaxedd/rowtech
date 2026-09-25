import type { Metadata } from "next";

/** The site's absolute origin, for metadata and structured data. */
export const siteUrl =
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

/** The home page's title, and the site's name for itself when shared. */
export const siteTitle = "RowTech: the force curve from every seat in the boat";

/** Every tab title: the page's, then the brand. */
export const titleTemplate = "%s | RowTech";

// What every page shares when it's shared. Next replaces a parent's openGraph
// and twitter wholesale when a page sets its own, so pages spread these in.
export const openGraphBase = {
  siteName: "RowTech",
  locale: "en_US",
  type: "website",
  images: [{ url: "/og.png", width: 1200, height: 630, alt: siteTitle }],
} satisfies Metadata["openGraph"];
export const twitterBase = {
  card: "summary_large_image",
  images: ["/og.png"],
} satisfies Metadata["twitter"];

/**
 * A public page's title, description, canonical URL and share tags, so a link
 * to it unfurls as that page, not as the home page.
 */
export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  const shared = titleTemplate.replace("%s", title);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...openGraphBase, title: shared, description, url: path },
    twitter: { ...twitterBase, title: shared, description },
  };
}

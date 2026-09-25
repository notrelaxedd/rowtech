import type { Metadata } from "next";

/** The site's absolute origin, for metadata and structured data. */
export const siteUrl =
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

/** The home page's title, and the site's name for itself when shared. */
export const siteTitle = "RowTech: the force curve from every seat in the boat";

/** Every tab title, site and dashboard alike: the page's, then the brand. */
export const titleTemplate = "%s · RowTech";

/**
 * public/og.png, and what's in it: the alt text describes the picture, not
 * the page (the share title already names that). It changes with the image.
 * So does the version in the URL: the sites a link is shared on keep an
 * image by its URL, so a new one needs a new URL to show.
 */
const shareImage = {
  url: "/og.png?v=2",
  width: 1200,
  height: 630,
  alt: "Concept render of a Force node, its screen showing a force curve, next to the home page’s headline and an Apply for the beta button.",
};

// What every page shares when it's shared. Next replaces a parent's openGraph
// and twitter wholesale when a page sets its own, so pages spread these in.
export const openGraphBase = {
  siteName: "RowTech",
  locale: "en_US",
  type: "website",
  images: [shareImage],
} satisfies Metadata["openGraph"];
export const twitterBase = {
  card: "summary_large_image",
  images: [shareImage],
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

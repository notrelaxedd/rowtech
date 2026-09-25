import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// The dashboard and sign-in are private (and noindex); crawlers needn't fetch
// them to find that out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app/", "/auth/"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

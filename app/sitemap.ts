import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// The public pages. Add a page here when it goes on the site.
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/force", "/vieve", "/beta", "/privacy", "/terms"].map((path) => ({ url: new URL(path, siteUrl).href }));
}

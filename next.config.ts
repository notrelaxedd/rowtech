import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework (and its version's advisories) on every response.
  poweredByHeader: false,
  experimental: {
    // The largest thing any action takes is an upload of a crew's session
    // files: about 210 bytes a stroke (a 128-byte curve plus its CSV line), so
    // nine seats of a long practice (~2,000 strokes each) is under 4 MB, and
    // less zipped. It also caps what the unauthenticated actions (the beta
    // form, the magic link) will read before they run.
    serverActions: { bodySizeLimit: "8mb" },
  },
  async redirects() {
    return [
      // The team page is off the site for now and will come back, so this is
      // temporary (307): old links to it land on the home page meanwhile.
      { source: "/team", destination: "/", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nothing on the site is meant to be framed: no one can overlay the
          // sign-in form, Upload or Sign out inside their own page.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Vercel sends max-age alone; this adds subdomains and preload-list
          // eligibility. Browsers ignore it over plain HTTP (local builds).
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      // The icon and the share image carry no hash in their paths (the page
      // links the icon with its hash as a query instead), so they're cached
      // for a day and then served stale while they're checked, rather than
      // checked on every page view.
      ...["/icon.svg", "/og.png"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      })),
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75],
  },
};

export default nextConfig;

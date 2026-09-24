import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // The largest thing any action takes is an upload of a crew's session
    // files: about 210 bytes a stroke (a 128-byte curve plus its CSV line), so
    // nine seats of a long practice (~2,000 strokes each) is under 4 MB, and
    // less zipped. It also caps what the unauthenticated actions (the beta
    // form, the magic link) will read before they run.
    serverActions: { bodySizeLimit: "8mb" },
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
        ],
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75],
  },
};

export default nextConfig;

import type { Metadata, Viewport } from "next";
import { Archivo, Chivo_Mono } from "next/font/google";
import "./globals.css";
import { AttributionCapture } from "@/components/site/attribution";
import { Analytics as ProductAnalytics } from "@/components/site/analytics";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { openGraphBase, siteTitle, siteUrl, titleTemplate, twitterBase } from "@/lib/site";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

// Device output only: the numbers and file names the node shows or writes.
// Not preloaded: most pages show little of it, and it swaps in over a
// size-matched fallback, so it can wait its turn behind Archivo, which sets
// the headline. (A font called here is preloaded on every route or on none.)
const chivoMono = Chivo_Mono({
  variable: "--font-chivo-mono",
  subsets: ["latin"],
  preload: false,
});


// Pages set their own canonical URL and share title, description and url
// (pageMetadata in lib/site.ts); nothing here names one page, so nothing
// inherits the home page's.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: titleTemplate,
  },
  description:
    "A Force node on each seat's rigger backstay records the force curve of every stroke and shows it to the rower live. Vieve, the RowTech cox box, is in development. Coaches: apply for the beta.",
  applicationName: "RowTech",
  openGraph: openGraphBase,
  twitter: twitterBase,
};

// The browser's own bar matches the site header: deep river (globals.css).
export const viewport: Viewport = { themeColor: "#0a1c23" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${archivo.variable} ${chivoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AttributionCapture />
        {children}
        <ProductAnalytics />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

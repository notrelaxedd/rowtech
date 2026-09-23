import type { Metadata } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AttributionCapture } from "@/components/site/attribution";
import { Analytics as ProductAnalytics } from "@/components/site/analytics";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "RowTech — force from every seat in the boat",
    template: "%s · RowTech",
  },
  description:
    "See who's carrying the boat. A force sensor on the rigger of every seat measures every stroke, live on the seat and stroke by stroke afterwards. Vieve, the RowTech cox box, is on the way. Now choosing beta crews.",
  openGraph: {
    title: "RowTech — force from every seat in the boat",
    description:
      "Every seat, every stroke, measured. Now recruiting coaches and crews for the beta.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${archivo.variable} ${geistMono.variable} h-full antialiased`}
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

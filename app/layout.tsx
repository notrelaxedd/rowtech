import type { Metadata } from "next";
import { Archivo, Chivo_Mono } from "next/font/google";
import "./globals.css";
import { AttributionCapture } from "@/components/site/attribution";
import { Analytics as ProductAnalytics } from "@/components/site/analytics";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { siteUrl } from "@/lib/site";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

// Device output only: the numbers and file names the node shows or writes.
const chivoMono = Chivo_Mono({
  variable: "--font-chivo-mono",
  subsets: ["latin"],
});


export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "RowTech: the force curve from every seat in the boat",
    template: "%s | RowTech",
  },
  description:
    "A Force node on each seat's rigger backstay records the force curve of every stroke and shows it to the rower live. Vieve, the RowTech cox box, is in development. Coaches: apply for the beta.",
  applicationName: "RowTech",
  alternates: { canonical: "/" },
  openGraph: {
    title: "RowTech: the force curve from every seat in the boat",
    description:
      "Seat-by-seat force measurement for rowing. Coaches: apply for the beta.",
    url: "/",
    siteName: "RowTech",
    locale: "en_US",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "RowTech: the force curve from every seat in the boat" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RowTech: the force curve from every seat in the boat",
    description: "Seat-by-seat force measurement for rowing. Coaches: apply for the beta.",
    images: ["/og.png"],
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

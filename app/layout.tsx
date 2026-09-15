import type { Metadata } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Attribution } from "@/components/site/attribution";
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
    "A force sensor on the rigger of every seat. Every stroke measured, live on the seat and reviewed stroke by stroke afterwards, with a cox box of our own on the way. Now recruiting beta crews.",
  openGraph: {
    title: "RowTech — force from every seat in the boat",
    description:
      "Every seat, every stroke, measured. Now recruiting coaches and crews for the beta.",
    images: [{ url: "/product/device-hero.webp", width: 1496, height: 1030 }],
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
        <Attribution />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}

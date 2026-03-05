import type { Metadata } from "next";
import "./globals.css";
import { fontSans } from "./font";
import Nav from "@/components/Nav";
import SeoJsonLd from "@/components/SeoJsonLd";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Rita Zanicchi · Personal Trainer",
  description: "Allenamenti brevi ed efficaci per donne over 50. Ritrova lucidità ed energia con il metodo Fit & Smile.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.fitandsmile.it"),
  openGraph: {
    type: "website",
    url: "/",
    locale: "it_IT",
    title: "Rita Zanicchi · Personal Trainer",
    description: "Allenamenti brevi ed efficaci per donne over 50. Ritrova lucidità ed energia con il metodo Fit & Smile.",
    images: [{ url: "/hero/rita-hero.jpg", width: 1200, height: 630, alt: "Rita Zanicchi - Personal Trainer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rita Zanicchi · Personal Trainer",
    description: "Allenamenti brevi ed efficaci per donne over 50. Ritrova lucidità ed energia con il metodo Fit & Smile.",
    images: ["/hero/rita-hero.jpg"],
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  alternates: { canonical: "/" },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body
        className={`${fontSans.className} antialiased bg-[var(--bg)] text-[var(--text)]`}
      >
        <Nav />
        {children}
        <Footer />
        <SeoJsonLd />
        <Toaster richColors position="top-right" toastOptions={{ className: 'mt-14' }} />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

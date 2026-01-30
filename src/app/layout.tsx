import type { Metadata } from "next";
import "./globals.css";
import { fontSans } from "./font";
import Nav from "@/components/Nav";
import SeoJsonLd from "@/components/SeoJsonLd";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Rita Zanicchi · Personal Trainer",
  description: "Allenamenti brevi ed efficaci per donne over 50. Ritrova lucidità ed energia con il metodo Fit & Smile.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://ritazanicchi-pt.it"),
  openGraph: {
    type: "website",
    url: "/",
    locale: "it_IT",
    title: "Rita Zanicchi · Personal Trainer",
    description: "Allenamenti brevi ed efficaci per donne over 50. Ritrova lucidità ed energia con il metodo Fit & Smile.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rita Zanicchi · Personal Trainer",
    description: "Allenamenti brevi ed efficaci per donne over 50. Ritrova lucidità ed energia con il metodo Fit & Smile.",
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
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
import { Toaster } from "sonner";

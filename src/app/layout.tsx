import type { Metadata } from "next";
import "./globals.css";
import { fontSans } from "./font";
import Nav from "@/components/Nav";
import SeoJsonLd from "@/components/SeoJsonLd";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Rita Zanicchi · Personal Trainer",
  description: "Allenamenti brevi ed efficaci per donne con poco tempo.",
  metadataBase: new URL("https://ritapt.example"),
  openGraph: {
    type: "website",
    url: "/",
    locale: "it_IT",
    title: "Rita Zanicchi · Personal Trainer",
    description: "Allenamenti brevi ed efficaci per donne con poco tempo.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rita Zanicchi · Personal Trainer",
    description: "Allenamenti brevi ed efficaci per donne con poco tempo.",
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  alternates: { canonical: "/" },
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
      </body>
    </html>
  );
}

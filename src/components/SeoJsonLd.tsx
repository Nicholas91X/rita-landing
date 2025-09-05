import React from "react";
import { site } from "@/content/it";

export default function SeoJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Rita Zanicchi – Personal Trainer",
    url: "https://ritapt.example",
    image: "https://ritapt.example/og.jpg",
    logo: {
      "@type": "ImageObject",
      url: site.assets.logo,
    },
    telephone: site.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      addressLocality: site.address.city,
      addressRegion: site.address.region,
      postalCode: site.address.cap,
      addressCountry: site.address.country,
    },
    priceRange: "€€",
    areaServed: "Provincia della Spezia",
    openingHours: "Mo-Fr 09:00-19:00",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

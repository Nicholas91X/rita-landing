"use client";

import Image from "next/image";
import Link from "next/link";
import { site } from "@/content/it";

export type LogoProps = {
  /** Altezza del logo per variant="brand" o diametro per variant="circle" */
  height?: number;
  /** "brand" (orizzontale) o "circle" (avatar rotondo) */
  variant?: "brand" | "circle";
  /** Mostra anche il testo brand accanto al logo */
  showText?: boolean;
  /** Classi extra sul link wrapper */
  className?: string;
  /** Solo per variant="circle": colore di sfondo (es. "#fff" o "rgba(255,255,255,.8)") */
  bg?: string;
  /** Solo per variant="circle": padding interno in px (default 6) */
  padding?: number;
  /** Solo per variant="circle": mostra bordo sottile */
  border?: boolean;
};

export default function Logo({
  height = 32,
  variant = "brand",
  showText = false,
  className,
  bg = "var(--panel)",
  padding = 6,
  border = true,
}: LogoProps) {
  const alt = site.assets.logoAlt ?? site.brand;

  if (variant === "circle") {
    const size = height;

    return (
      <Link
        href="/"
        className={["flex items-center gap-2", className || ""].join(" ")}
        aria-label={site.brand}
      >
        <span
          className="relative inline-block overflow-hidden rounded-full"
          style={{
            width: size,
            height: size,
            background: bg,
            padding,
            border: border ? "2px solid var(--border)" : undefined,
          }}
        >
          <Image
            src={site.assets.logo}
            alt={alt}
            fill
            className="object-contain"
            sizes={`${size}px`}
            priority
          />
        </span>
        {showText && (
          <span className="font-semibold tracking-tight">{site.brand}</span>
        )}
      </Link>
    );
  }

  // variant === "brand" → logo orizzontale con ratio
  const ratio =
    site.assets.logoWidth && site.assets.logoHeight
      ? site.assets.logoWidth / site.assets.logoHeight
      : 3;
  const width = Math.round(height * ratio);

  return (
    <Link
      href="/"
      className={["flex items-center gap-2", className || ""].join(" ")}
      aria-label={site.brand}
    >
      <Image
        src={site.assets.logo}
        alt={alt}
        width={width}
        height={height}
        sizes={`${width}px`}
        priority
      />
      {showText && (
        <span className="font-semibold tracking-tight">{site.brand}</span>
      )}
    </Link>
  );
}

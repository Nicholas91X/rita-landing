"use client";
import * as Icons from "lucide-react";
import { site } from "@/content/it";

type Props = {
  className?: string;
  variant?: "light" | "dark";
  size?: number;
};

/** Fallback TikTok se non presente nella tua versione di lucide-react */
function TikTokGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M21 8.5a7.5 7.5 0 0 1-5.2-2.17V14a6 6 0 1 1-6-6c.28 0 .55.02.82.06v3.12A3.5 3.5 0 1 0 11.5 17 3.5 3.5 0 0 0 15 13.5V3h3a7.5 7.5 0 0 0 3 5.5Z" />
    </svg>
  );
}

const ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  facebook: Icons.Facebook,
  instagram: Icons.Instagram,
  youtube: Icons.Youtube,
  tiktok: TikTokGlyph,
};

export default function Socials({
  className = "",
  variant = "light",
  size = 36,
}: Props) {
  const socials: Record<string, string | undefined> = site.socials ?? {};
  const entries = Object.entries(socials).filter(([, url]) => !!url);

  const btnBase =
    "inline-flex items-center justify-center rounded-full border-2 border-[var(--primary)] transition hover:opacity-90 focus:outline-none";
  const light = "text-white hover:bg-white/10";
  const dark = "text-[var(--secondary)] hover:bg-[var(--panel)]";

  if (entries.length === 0) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {entries.map(([key, url]) => {
        const Icon = ICONS[key.toLowerCase()];
        if (!Icon) return null;
        return (
          <a
            key={key}
            href={url as string}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={key}
            className={`${btnBase} ${variant === "light" ? light : dark}`}
            style={{ width: size, height: size }}
            title={key.charAt(0).toUpperCase() + key.slice(1)}
          >
            {/* lucide usa stroke currentColor; il fallback TikTok usa fill currentColor */}
            {/* per uniformità manteniamo dimensioni 16px all'interno del cerchio */}
            {Icon === TikTokGlyph ? (
              <Icon className="w-4 h-4" />
            ) : (
              <Icon className="w-4 h-4" strokeWidth={2} />
            )}
          </a>
        );
      })}
    </div>
  );
}

"use client";
import Image from "next/image";
import * as React from "react";

type Props = {
  left: string[]; // es: ["/side/left-1.jpg", "/side/left-2.jpg", ...]
  right: string[]; // es: ["/side/right-1.jpg", "/side/right-2.jpg", ...]
  width?: number; // larghezza colonna in px (default 120)
  gap?: number; // gap tra foto (default 12)
  speedSec?: number; // durata animazione (default 22)
};

export default function SideMarquees({
  left,
  right,
  width = 120,
  gap = 12,
  speedSec = 22,
}: Props) {
  return (
    <div className="pointer-events-none">
      {/* Sinistra */}
      <Column
        side="left"
        images={left}
        width={width}
        gap={gap}
        speedSec={speedSec}
      />
      {/* Destra */}
      <Column
        side="right"
        images={right}
        width={width}
        gap={gap}
        speedSec={speedSec}
        reverse
      />
    </div>
  );
}

function Column({
  side,
  images,
  width,
  gap,
  speedSec,
  reverse = false,
}: {
  side: "left" | "right";
  images: string[];
  width: number;
  gap: number;
  speedSec: number;
  reverse?: boolean;
}) {
  const style: React.CSSProperties & {
    "--marquee-gap"?: string;
    "--marquee-duration"?: string;
  } = {
    width,
    "--marquee-gap": `${gap}px`,
    "--marquee-duration": `${speedSec}s`,
  };

  return (
    <aside
      className={[
        "side-marquee hidden 2xl:block fixed top-[96px] bottom-0 z-40",
        side === "left" ? "left-2" : "right-2",
      ].join(" ")}
      style={style}
      aria-hidden
    >
      <div className="side-marquee__mask">
        {/* Doppio track per loop continuo */}
        <div
          className={["marquee", reverse ? "marquee--reverse" : ""].join(" ")}
        >
          <Track images={images} width={width} gap={gap} />
          <Track images={images} width={width} gap={gap} ariaHidden />
        </div>
      </div>
    </aside>
  );
}

function Track({
  images,
  width,
  gap,
  ariaHidden = false,
}: {
  images: string[];
  width: number;
  gap: number;
  ariaHidden?: boolean;
}) {
  return (
    <ul className="flex flex-col" style={{ gap }} aria-hidden={ariaHidden}>
      {images.map((src, i) => (
        <li
          key={i}
          className="relative overflow-hidden rounded-2xl border border-[var(--border)]"
          style={{ width, height: Math.round(width * 1.4) }}
        >
          <Image
            src={src}
            alt=""
            fill
            className="object-cover"
            sizes={`${width}px`}
            priority={false}
          />
        </li>
      ))}
    </ul>
  );
}

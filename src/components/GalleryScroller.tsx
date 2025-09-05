"use client";
import Image from "next/image";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function GalleryScroller({ images }: { images: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: number) =>
    ref.current?.scrollBy({
      left: dir * (ref.current.clientWidth * 0.9),
      behavior: "smooth",
    });

  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-none"
      >
        {images.map((src, i) => (
          <div key={i} className="snap-center shrink-0 w-full md:w-1/3">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-[var(--border)]">
              <Image
                src={src}
                alt={`Galleria ${i + 1}`}
                fill
                className="object-cover"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Controls visibili da md in su */}
      <div className="absolute top-1/2 -translate-y-1/2 left-2 z-10 pointer-events-none">
        <button
          onClick={() => scrollBy(-1)}
          className="pointer-events-auto rounded-full bg-[var(--panel)] p-2 border border-[var(--border)]"
          aria-label="Precedente"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 right-2 z-10 pointer-events-none">
        <button
          onClick={() => scrollBy(1)}
          className="pointer-events-auto rounded-full bg-[var(--panel)] p-2 border border-[var(--border)]"
          aria-label="Successiva"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

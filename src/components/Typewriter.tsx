"use client";
import { useEffect, useState } from "react";

export default function Typewriter({
  text,
  startDelay = 0,
  speed = 40,
  className = "",
  caret = true,
}: {
  text: string;
  startDelay?: number;
  speed?: number;
  className?: string;
  caret?: boolean;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    let t2: ReturnType<typeof setInterval> | undefined;
    const t1 = setTimeout(() => {
      t2 = setInterval(() => {
        setI((n) => {
          if (n >= text.length) {
            clearInterval(t2);
            return n;
          }
          return n + 1;
        });
      }, speed);
    }, startDelay);
    return () => {
      clearTimeout(t1);
      clearInterval(t2);
    };
  }, [text, startDelay, speed]);

  return (
    <span className={className}>
      {text.slice(0, i)}
      {caret && i < text.length && <span className="tw-caret">▌</span>}
    </span>
  );
}

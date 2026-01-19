"use client";
import { useMemo, useState } from "react";

function previewHtmlKeepStrong(html: string, maxWords: number) {
  const openTag = "__STRONG_OPEN__";
  const closeTag = "__STRONG_CLOSE__";
  const brTag = "__BR__";
  const marked = html
    .replace(/<strong[^>]*>/gi, openTag)
    .replace(/<\/strong>/gi, closeTag)
    .replace(/<br\s*\/?>/gi, brTag)
    .replace(/<[^>]*>/g, " "); // drop others
  const words = marked.replace(/\s+/g, " ").trim().split(" ");
  const sliced =
    words.length > maxWords
      ? words.slice(0, maxWords).join(" ") + "…"
      : words.join(" ");
  return sliced
    .replaceAll(openTag, '<strong style="color: var(--foreground)">')
    .replaceAll(closeTag, "</strong>")
    .replaceAll(brTag, "<br />");
}

export default function CollapsibleHtml({
  html,
  maxWords = 90,
  moreLabel = "Leggi di più",
  lessLabel = "Leggi meno",
  textColor = "text-[var(--muted-foreground)]",
}: {
  html: string;
  maxWords?: number;
  moreLabel?: string;
  lessLabel?: string;
  textColor?: string;
}) {
  const [open, setOpen] = useState(false);
  const preview = useMemo(
    () => previewHtmlKeepStrong(html, maxWords),
    [html, maxWords]
  );

  return (
    <div>
      <div className={`leading-relaxed ${textColor} richtext`}>
        {open ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <div dangerouslySetInnerHTML={{ __html: preview }} />
        )}
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 text-sm underline text-[var(--brand)] hover:opacity-80"
      >
        {open ? lessLabel : moreLabel}
      </button>
    </div>
  );
}

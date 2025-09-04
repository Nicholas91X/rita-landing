import * as React from "react";

type Props = { id?: string; className?: string; children: React.ReactNode };
export default function Section({ id, className = "", children }: Props) {
  return (
    <section id={id} className={`py-16 md:py-24 scroll-mt-28 ${className}`}>
      {children}
    </section>
  );
}

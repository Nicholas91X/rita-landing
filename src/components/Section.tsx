import * as React from "react";

type Props = { id?: string; className?: string; children: React.ReactNode };
export default function Section({ id, className = "", children }: Props) {
  return (
    <>
      <section id={id} className={`py-16 md:py-24 scroll-mt-28 ${className}`}>
        <div className="max-w-6xl mx-auto px-8 md:px-10 lg:px-26 xl:px-26">
          {children}
        </div>
      </section>
    </>
  );
}

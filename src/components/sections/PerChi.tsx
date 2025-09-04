import Image from "next/image";
import Section from "../Section";
import { perChi } from "@/content/it";

export default function PerChi() {
  return (
    <Section id="perchi" className="section">
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h2 className="h2">A chi mi rivolgo?</h2>
          <ul className="mt-6 space-y-2">
            {perChi.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span>•</span>
                <span className=" text-[var(--muted-foreground)]">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative h-64 md:h-100 rounded-3xl overflow-hidden border border-[var(--border)]">
          <Image
            src="/perchi/perchi-1.jpg"
            alt="Donne che si allenano: il target del metodo"
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 40vw, 90vw"
          />
        </div>
      </div>
    </Section>
  );
}

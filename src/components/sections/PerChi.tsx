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
        <div className="h-64 md:h-80 panel flex items-center justify-center">
          <span className="font-semibold text-[var(--brand)]">
            (Immagine target)
          </span>
        </div>
      </div>
    </Section>
  );
}

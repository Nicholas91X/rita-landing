import Image, { type StaticImageData } from "next/image";
import Section from "../Section";
import { Card } from "@/components/ui/card";

import step1 from "../../../public/metodo/step-1.jpg";
import step2 from "../../..//public/metodo/step-2.jpg";
import step3 from "../../..//public/metodo/step-3.jpg";

type Step = {
  id: string;
  t_0: string;
  d_0: string;
  t: string;
  d: string;
  img: StaticImageData;
  alt: string;
};

export default function Metodo() {
  const steps: Step[] = [
    {
      id: "metodo-step-1",
      t_0: "1. CONSULENZA GRATUITA",
      d_0: "Qualche domanda per conoscerci e piccoli test per conoscere le tue capacità fisiche  (30' - 40').",
      t: "anamnesi e capacità",
      d: "Una breve consulenza dove, attraverso poche domande, metterò su carta i tuoi desideri. Nella stessa seduta valuteremo le tue capacità di partenza per creare un allenamento personalizzato con 2 o 3 sedute settimanali su misura per te.",
      img: step1,
      alt: "Anamnesi, valutazione delle capacità e definizione obiettivi",
    },
    {
      id: "metodo-step-2",
      t_0: "2. PERCORSO PERSONALIZZATO",
      d_0: "Con 2 o 3 allenamenti settimanali di 30' ciascuno per 6 settimane.",
      t: "percorso personalizzato",
      d: "Grazie alle informazioni raccolte dalla consulenza, imposterò 2 o 3 sedute settimanali da 30' per 6 settimane, focalizzate sul tuo miglioramento. I primi risultati arrivano intorno alla sesta settimana.",
      img: step2,
      alt: "Allenamento personalizzato con trainer",
    },
    {
      id: "metodo-step-3",
      t_0: "3. COMPITI A CASA",
      d_0: "Facili compiti per abbandonare le cattive abitudini solo pochi minuti al giorno.",
      t: "compiti a casa",
      d: "Niente paura! Compiti semplici che richiederanno solo pochi minuti al giorno ma che ti aiuteranno a raggiungere l'obiettivo. Abbandona le brutte abitudini e ritrova la migliore versione di te.",
      img: step3,
      alt: "Esercizi semplici a casa",
    },
  ];

  return (
    <Section id="metodo">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-extrabold">
          Il mio metodo in 3 step
        </h2>
        <p className="mt-3 text-[var(--muted-foreground)]">
          Allenamenti personalizzati, brevi ed efficaci.
        </p>
      </div>

      <div className="mt-10 grid lg:grid-cols-3 gap-6">
        {steps.map(({ id, t_0, d_0, t, d, img, alt }) => (
          <Card
            key={id}
            id={id}
            className="p-6 bg-[var(--accent-foreground)] border-0 text-white"
          >
            <div className="p-6">
              <h3 className="underline decoration-[var(--brand)] decoration-2 underline-offset-4 text-[var(--brand)] text-left font-semibold capitalize">
                {t_0}
              </h3>
              <p className="mt-4 text-left text-[var(--muted-foreground)] leading-relaxed">
                {d_0}
              </p>
            </div>

            {/* Foto */}
            <figure className="relative w-full aspect-[4/3]">
              <Image
                src={img}
                alt={alt}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 28vw, (min-width: 768px) 45vw, 92vw"
                placeholder="blur"
                priority={false}
              />
            </figure>

            {/* Testi */}
            <div className="p-6">
              <h3 className="underline decoration-[var(--brand)] decoration-2 underline-offset-4 text-[var(--brand)] text-left font-semibold capitalize">
                {t}
              </h3>
              <p className="mt-4 text-left text-[var(--muted-foreground)] leading-relaxed">
                {d}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}

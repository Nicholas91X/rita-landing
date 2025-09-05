"use client";
import Section from "../Section";
import { Card } from "@/components/ui/card";
import { storia } from "@/content/it";
import CollapsibleHtml from "@/components/CollapsibleHtml";
import GalleryScroller from "@/components/GalleryScroller";
import { ClipboardList, Dumbbell, House } from "lucide-react";

export default function Storia() {
  const gallery = [
    "/storia/gal-1.jpg",
    "/storia/gal-2.jpg",
    "/storia/gal-3.jpg",
    "/storia/gal-4.jpg",
    "/storia/gal-5.jpg",
  ];

  return (
    <Section id="storia" className="section">
      {/* Titolo fuori dalla grid per allineare il Card all'inizio del testo */}
      <h2 className="h2">{storia.title}</h2>
      <div className="mt-4 grid md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-2">
          <CollapsibleHtml html={storia.body} maxWords={90} />
        </div>
        <Card className="p-6">
          <ul className="text-sm text-[var(--foreground)] space-y-2">
            {storia.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </Card>
        {/* Gallery slideshow (1 su sm, 3 su md) */}
        <div className="md:col-span-3 mt-6">
          <GalleryScroller images={gallery} />
        </div>
        {/* Testo aggiuntivo dopo la gallery */}
        <div className="md:col-span-3 mt-6">
          <p className="leading-relaxed text-white">
            Sì è stato difficile tornare a studiare alla mia età, ma la +
            soddisfazione nell&apos;essere arrivata fino alla fine è
            <strong className="text-black"> IMPAGABILE</strong>!!!
            <br />
            <br />
            Ora voglio dedicarmi a far stare bene proprio donne che come me
            hanno poco tempo e non vogliono rinunciare ai loro sogni, migliorare
            il proprio aspetto e eliminare le abitudini sbagliate.
            <br />
            <br />
            Ridare forza e coraggio a donne che hanno voglia di cambiare e di
            migliorarsi. Il tempo non dev&apos;essere un ostacolo alle proprie +
            ambizioni. Donne che: la famiglia, il lavoro, la casa, hanno
            travolto lasciandole quasi senza respiro. Basta fare solo un passo
            alla volta, per cambiare completamente. Ritrovare tempo per se
            stesse.<strong className="text-black"> TI RICONOSCI?</strong>
          </p>
        </div>
        {/* Riassunto metodo in 3 step – elegante, moderno */}
        <div className="md:col-span-3 mt-10">
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-6">
            <h3 className="text-xl font-bold text-[var(--secondary)] mb-4">
              Il mio metodo attraverso 3 step
            </h3>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="flex items-start gap-4">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-white shrink-0">
                  <ClipboardList className="h-5 w-5" />
                  <ClipboardList className="h-5 w-5" />
                </span>

                <div>
                  <p className="font-semibold">
                    Consulenza gratuita & valutazione capacità
                  </p>

                  <p className="text-sm text-[var(--accent-foreground)]">
                    per costruire l&apos;allenamento su misura per te
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-white shrink-0">
                  <Dumbbell className="h-5 w-5" />
                </span>

                <div>
                  <p className="font-semibold">Allenamento personalizzato</p>

                  <p className="text-sm text-[var(--accent-foreground)]">
                    2 o 3 sedute settimanali da 30&apos;
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-white shrink-0">
                  <House className="h-5 w-5" />
                </span>

                <div>
                  <p className="font-semibold">Compiti a casa</p>
                  <p className="text-sm text-[var(--accent-foreground)]">
                    piccoli accorgimenti per eliminare le cattive abitudini
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-6 text-[var(--foreground)] leading-relaxed">
              Un programma personalizzato con 2 o 3 sedute settimanali da 30&apos;,
              che permette già in <strong>6 settimane</strong> di vedere i primi
              cambiamenti!
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

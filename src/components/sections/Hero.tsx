"use client";
import { CtaRow, CtaWhatsApp } from "../Cta";
import Section from "../Section";
import { Button } from "@/components/ui/button";
import { site } from "@/content/it";

const CTA_WA =
  "https://wa.me/393472292627?text=Ciao%20Rita%21%20Vorrei%20una%20consulenza.";

export default function Hero() {
  return (
    <Section id="top" className="section">
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h1 className="h1">
            NON FAR VINCERE LA PAURA,
            <br />
            <span className="text-[var(--brand)]">FAI VIVERE I TUOI SOGNI</span>
          </h1>
          <p className="mt-5 text-lg lead">
            Ciao, sono Rita, laureata in Scienze Motorie. Ho creato un{" "}
            <strong>metodo al femminile</strong>
            con allenamenti brevissimi ma efficaci.
          </p>
          <CtaRow>
            <CtaWhatsApp phone={site.phone} message={site.whatsappMessage} />
            <a
              href="#metodo"
              className="inline-flex items-center rounded-full border px-5 py-3 text-sm font-medium hover:bg-white"
            >
              Scopri il metodo
            </a>
          </CtaRow>
          <p className="mt-3 text-xs text-slate-500">
            {site.address.placeLabel}
          </p>
        </div>
        <div className="h-64 md:h-80 panel flex items-center justify-center">
          (placeholder immagine hero)
        </div>
      </div>
    </Section>
  );
}

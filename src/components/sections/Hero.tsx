"use client";
import Image from "next/image";
import { CtaRow, CtaWhatsApp } from "../Cta";
import Section from "../Section";
import { site } from "@/content/it";
import Typewriter from "@/components/Typewriter";

const CTA_WA =
  "https://wa.me/393472292627?text=Ciao%20Rita%21%20Vorrei%20una%20consulenza.";

export default function Hero() {
  return (
    <Section id="top" className="section">
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h1 className="h1 ts-white leading-tight">
            <Typewriter
              text="NON FAR VINCERE LA PAURA,"
              speed={65}
              startDelay={150}
            />
            <br />
            <Typewriter
              text="FAI VIVERE I TUOI SOGNI"
              speed={65}
              startDelay={2100}
              className="text-[var(--brand)]"
            />
          </h1>
          <p className="mt-5 text-lg lead">
            Benvenuto, mi chiamo{" "}
            <strong className="text-[var(--accent-foreground)]">
              Rita Zanicchi
            </strong>
            , sono laureata in scienze motorie e mi occupo di benessere
            psico-fisico. Da sempre la mia passione è il fitness, da quasi 30
            anni è il mio mondo, ed essendo donna ho deciso di affrontare più da
            vicino 
            <strong className="text-[var(--accent-foreground)]">
               l&apos;allenamento femminile
            </strong>
            . Le esigenze di noi donne sono tante, tanti impegni e poco tempo.
            Ho creato un MIO
            <strong className="text-[var(--accent-foreground)]">
              allenamento al femminile
            </strong>
            . Allenamenti personalizzati, brevi ed efficaci. 6 settimane per i
            primi risultati. Richiedi una consulenza gratuita.
            <strong className="text-[var(--accent-foreground)]">
              IL TEMPO: 30 MINUTI
            </strong>
          </p>
          <CtaRow>
            <CtaWhatsApp phone={site.phone} message={site.whatsappMessage} />
            <a
              href="#metodo"
              className="inline-flex items-center rounded-full border border-[var(--border)] px-5 py-3 text-sm font-medium bg-[var(--accent-foreground)]
+            text-white hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]"
            >
              Scopri il metodo
            </a>
          </CtaRow>
          <p className="mt-3 text-xs text-[var(--muted-foreground)]">
            {site.address.placeLabel}
          </p>
        </div>
        <div className="relative h-64 md:h-100 rounded-3xl overflow-hidden border border-[var(--border)]">
          <Image
            src="/hero/rita-hero.jpg"
            alt="Rita Zanicchi durante un allenamento personalizzato"
            fill
            className="object-cover"
            priority
            sizes="(min-width: 1024px) 40vw, 90vw"
          />
        </div>
      </div>
    </Section>
  );
}

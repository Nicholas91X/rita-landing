"use client";
import Section from "../Section";
import { perChi } from "@/content/it";
import { CtaWhatsApp } from "../Cta";
import { Check, Clock, Dumbbell, Sparkles } from "lucide-react";
import Image from "next/image";

export default function PerChi() {
  return (
    <Section id="perchi" className="section">
      <div className="grid md:grid-cols-2 gap-8 items-center">
        {/* Testo */}
        <div>
          <h2 className="h2">A chi mi rivolgo?</h2>
          <p className="mt-3 text-[var(--muted-foreground)]">
            Donne con poco tempo che vogliono tornare a stare bene senza
            stravolgere le proprie giornate.
          </p>


          {/* Lista punti dal contenuto */}
          <ul className="mt-6 space-y-3">
            {perChi.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-white mt-0.5 p-1.5 shrink-0">
                  <Check className="w-5 h-5" />
                </span>
                <span className="text-[var(--foreground)]">{item}</span>
              </li>
            ))}
          </ul>

          {/* Mini stats */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat icon={<Clock className="w-4 h-4" />} k="30’" v="a seduta" />
            <Stat
              icon={<Dumbbell className="w-4 h-4" />}
              k="2–3"
              v="volte/sett."
            />
            <Stat
              icon={<Sparkles className="w-4 h-4" />}
              k="6"
              v="settimane risultati"
            />
          </div>

          {/* CTA */}
          <div className="mt-6">
            <CtaWhatsApp />
          </div>
        </div>

        {/* Immagine con parallax + pannellino info */}
        <div className="relative h-64 md:h-96 rounded-3xl overflow-hidden border border-[var(--border)]">
          <Image
            src="https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/per-chi/per-chi.png"
            alt="Donne che si allenano: il target del metodo"
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 40vw, 90vw"
            priority={false}
          />
          <div className="absolute bottom-3 left-3 right-3">
            <div className="px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] backdrop-blur">
              <p className="text-sm font-medium text-[var(--foreground)]">
                Allenamenti brevi, sostenibili e su misura.
              </p>
              <div className="mt-1 flex gap-4 text-xs text-[var(--muted-foreground)]">
                <span className="inline-flex items-center gap-1 text-[var(--accent-foreground)]">
                  <Clock className="w-4 h-4 text-[var(--accent-foreground)]" />{" "}
                  30’
                </span>
                <span className="inline-flex items-center gap-1 text-[var(--accent-foreground)]">
                  <Dumbbell className="w-4 h-4 text-[var(--accent-foreground)]" />{" "}
                  2–3/sett.
                </span>
                <span className="inline-flex items-center gap-1 text-[var(--accent-foreground)]">
                  <Sparkles className="w-4 h-4 text-[var(--accent-foreground)]" />{" "}
                  6 settimane
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Stat({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white/70 p-3">
      <div className="flex items-center gap-2 text-[var(--secondary)]">
        {icon}
        <span className="text-lg font-bold">{k}</span>
      </div>
      <div className="text-xs text-[var(--accent-foreground)]">{v}</div>
    </div>
  );
}

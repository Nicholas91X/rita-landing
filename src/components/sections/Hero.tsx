"use client";
import Image from "next/image";
import { CtaRow, CtaWhatsApp } from "../Cta";
import Section from "../Section";
import { site } from "@/content/it";
import Typewriter from "@/components/Typewriter";

export default function Hero() {
  return (
    <Section id="top" className="py-20 md:py-32">
      <div className="grid lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Text Content */}
        <div className="lg:col-span-7 space-y-8">
          <header className="space-y-4">
            <div className="inline-flex items-center space-x-2 text-[var(--brand)] font-semibold tracking-widest uppercase text-xs">
              <span className="w-6 h-px bg-[var(--brand)]"></span>
              <span>{site.brand}</span>
            </div>

            <h1 className="flex items-center gap-3 text-5xl md:text-8xl font-bold tracking-tight text-[var(--foreground)] leading-[1.1]">
              <Typewriter
                text="Benvenuta"
                speed={80}
                startDelay={100}
              />
              <span className="text-[var(--brand)]">🧡</span>
            </h1>
          </header>

          <div className="max-w-2xl">
            <p className="text-2xl md:text-3xl text-[var(--secondary)] font-light leading-relaxed italic">
              Rilassa le spalle e fai un respiro profondo. <br />
              Non c&apos;è fretta. <br />
              Iniziamo insieme, un passo alla volta.
            </p>

            {/* Video Placeholder */}
            <div className="mt-10">
              <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-slate-50 border border-slate-100 group flex items-center justify-center shadow-inner cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-tr from-[var(--brand)]/5 to-transparent"></div>
                <div className="relative z-10 w-20 h-20 flex items-center justify-center rounded-full bg-white shadow-2xl text-[var(--brand)] group-hover:scale-110 transition-all duration-300">
                  <div className="ml-1 w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-current border-b-[10px] border-b-transparent"></div>
                </div>
              </div>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 text-center">
                Guarda questo video prima di fare qualsiasi altra cosa <br className="md:hidden" />
                <span className="text-[var(--brand)] ml-1">(Dura solo 1 minuto)</span>
              </p>
            </div>

            <div className="mt-12 flex flex-col space-y-6 text-slate-600/90 leading-relaxed font-light">
              <p className="text-lg">
                Fit & Smile è lo spazio sicuro dove ricominciare a muoverti senza sentirti giudicata,
                dove il tuo ritmo è quello giusto e dove non sei mai sola.
              </p>

              <div className="space-y-1">
                <p className="text-[var(--foreground)] font-medium italic">Fit & Smile non è solo allenamento.</p>
                <p className="text-2xl md:text-3xl font-bold text-[var(--brand)] leading-tight">
                  È il coraggio di rimetterti <br className="hidden md:block" /> al primo posto.
                </p>
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  ⌛ 30 Minuti
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  ✨ Risultati in 6 settimane
                </span>
              </div>
            </div>
          </div>

          <CtaRow>
            <CtaWhatsApp
              phone={site.phone}
              message={site.whatsappMessage}
              className="px-8 py-6 rounded-xl bg-[var(--foreground)] text-white hover:bg-[var(--brand)] transition-all duration-300 shadow-xl shadow-black/5"
            />
            <a
              href="#metodo"
              className="inline-flex items-center px-8 py-4 text-sm font-semibold text-[var(--foreground)] border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Scopri il metodo
            </a>
          </CtaRow>


        </div>

        {/* Right Column: Imagery */}
        <div className="lg:col-span-5 relative">
          <div className="relative z-10 aspect-[4/5] rounded-[2rem] overflow-hidden shadow-2xl">
            <Image
              src="/hero/rita-hero.jpg"
              alt="Rita Zanicchi durante un allenamento personalizzato"
              fill
              className="object-cover transition-transform duration-700 hover:scale-105"
              priority
              sizes="(min-width: 1024px) 30vw, 90vw"
            />
          </div>

          {/* Decorative Minimalist Accents */}
          <div className="absolute -z-10 -bottom-6 -right-6 w-full h-full border-2 border-[var(--brand)]/10 rounded-[2rem]"></div>
          <div className="absolute -z-10 -top-6 -left-6 w-24 h-24 bg-[var(--accent)]/20 rounded-full blur-2xl"></div>
        </div>
      </div>
    </Section>
  );
}

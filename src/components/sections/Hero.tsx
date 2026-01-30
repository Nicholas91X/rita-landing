"use client";
import Image from "next/image";
import { CtaRow } from "../Cta";
import Section from "../Section";
import { site } from "@/content/it";
import Typewriter from "@/components/Typewriter";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Plane } from "lucide-react";

export default function Hero() {
  return (
    <Section id="top" className="py-12 md:py-24 overflow-hidden bg-[#FFFCFC]">
      <div className="max-w-4xl mx-auto text-center space-y-12 md:space-y-16">
        {/* Header content */}
        <header className="space-y-8">
          <div className="space-y-3">
            <div className="inline-flex items-center justify-center space-x-2 text-[var(--brand)] font-semibold tracking-widest uppercase text-[10px]">
              <span className="w-6 h-px bg-[var(--brand)]"></span>
              <span>{site.brand}</span>
            </div>
            <h2 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tighter text-[var(--foreground)] leading-none flex items-center justify-center gap-2 md:gap-3 italic whitespace-nowrap">
              <span>FIT</span>
              <span className="text-3xl sm:text-4xl md:text-6xl text-[var(--brand)] font-light not-italic">&</span>
              <span className="-ml-1 md:-ml-2">smile</span>
            </h2>
          </div>

          <div className="space-y-4">
            <h1 className="flex items-center justify-center gap-3 text-3xl md:text-5xl font-bold tracking-tight text-[var(--secondary)]">
              <Typewriter text="Benvenuta" speed={80} startDelay={100} />
              <span className="text-[var(--brand)]">🧡</span>
            </h1>
            <p className="text-xl md:text-3xl text-[var(--secondary)] font-light leading-relaxed italic max-w-2xl mx-auto">
              Rilassa le spalle e fai un respiro profondo. <br className="hidden md:block" />
              Iniziamo insieme, un passo alla volta.
            </p>
          </div>
        </header>

        {/* The section with World Map Background */}
        <div className="relative">
          {/* Stylized background elements for Travel Style */}
          <div className="absolute inset-0 -mx-4 md:-mx-24 pointer-events-none z-0">
            {/* Map Placeholder */}
            <div className="absolute inset-0 opacity-10">
              <Image
                src="/images/map-placeholder.svg"
                alt=""
                fill
                className="object-contain object-center scale-150 md:scale-125"
                priority
              />
            </div>
            {/* Dotted Travel Path */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-full opacity-20">
              <Image
                src="/images/travel-path.svg"
                alt=""
                fill
                className="object-contain"
              />
            </div>
          </div>

          <div className="relative z-10 space-y-24 md:space-y-32 py-12">
            {/* Video component */}
            <div className="relative group max-w-3xl mx-auto">
              {/* Background Glow */}
              <div className="absolute -inset-4 bg-gradient-to-tr from-[var(--brand)]/10 to-transparent blur-3xl opacity-50"></div>

              <div className="relative aspect-video w-full rounded-[2.5rem] overflow-hidden bg-slate-900 border-4 md:border-8 border-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] transition-all duration-700">
                <video
                  src="https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/videos/video_hero.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                  className="w-full h-full object-cover scale-[1.01]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none opacity-60"></div>
              </div>

              {/* Floating Info Tag */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl border border-white/20 whitespace-nowrap z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Guarda come lavoriamo <span className="text-[var(--brand)] ml-1">🧡</span>
                </p>
              </div>
            </div>

            {/* Passport section text */}
            <div className="space-y-10">
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-[#F46530] leading-tight tracking-tight flex items-center justify-center gap-x-3 md:gap-x-6 uppercase">
                    <span>Destinazione: Te Stessa</span>
                    <Plane className="w-6 h-6 sm:w-10 sm:h-10 md:w-12 md:h-12 rotate-45 text-[#F46530] opacity-40" />
                  </h3>
                  <p className="text-lg md:text-xl font-bold text-[#4a4a4a] italic max-w-2xl mx-auto">
                    Il metodo Fit & Smile per vivere la Menopausa con gioia
                  </p>
                </div>
                <div className="space-y-4 max-w-2xl mx-auto px-4">
                  <p className="text-lg md:text-2xl text-slate-700 font-medium leading-relaxed">
                    Dimentica le palestre tristi e noiose.<br />
                    Qui ci alleniamo <span className="text-[#F46530] font-bold">esplorando il mondo</span>.<br />
                    Ogni mese una nuova destinazione (Bali, New York, L&apos;Avana...)<br />
                    per ritrovare il sorriso, la forma e te stessa.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-4">
                <div className="px-6 py-3 rounded-2xl bg-white border border-[#F46530]/20 text-[11px] font-bold uppercase tracking-widest text-[#F46530] shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#F46530]/40" />
                  ⌛ 30 Minuti
                </div>
                <div className="px-6 py-3 rounded-2xl bg-white border border-[#F46530]/20 text-[11px] font-bold uppercase tracking-widest text-[#F46530] shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#F46530]/40" />
                  ✨ Risultati in 6 settimane
                </div>
              </div>
            </div>

            <CtaRow className="justify-center pt-4">
              <Button asChild className="px-6 py-3 rounded-xl bg-[var(--brand)] text-white hover:bg-[#7f554f] transition-all duration-300 shadow-lg shadow-orange-900/10 hover:-translate-y-0.5 active:scale-95 text-xs font-black uppercase tracking-[0.1em] h-auto group animate-pulse-cta">
                <Link href="/login" className="flex items-center gap-2">
                  Inizia il Viaggio (Prova Gratis)
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </CtaRow>

            {/* Pain Points Section */}
            <div className="pt-16 pb-8 md:pt-24 md:pb-12 max-w-3xl mx-auto space-y-12 bg-[#f3efec] rounded-[3rem] p-8 md:p-12 border border-slate-100/50 shadow-sm">
              <div className="space-y-4">
                <h3 className="text-3xl md:text-5xl font-black text-[#2A2E30] tracking-tight">
                  Ti senti anche tu così?
                </h3>
                <div className="w-16 h-1 bg-[var(--brand)]/20 mx-auto rounded-full"></div>
              </div>

              <div className="space-y-8 text-left max-w-2xl mx-auto">
                {[
                  "Ti guardi allo specchio e non riconosci più il tuo corpo (gonfiore, girovita cambiato).",
                  "Hai provato a fare ginnastica ma ti annoi o hai paura di farti male alla schiena.",
                  "Ti senti \"arrugginita\" e l'idea di saltare o correre ti mette ansia."
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 group">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-sm border border-red-100 group-hover:scale-110 transition-transform">
                      ❌
                    </span>
                    <p className="text-lg md:text-xl text-slate-600 font-medium leading-relaxed">
                      {item}
                    </p>
                  </div>
                ))}
              </div>

              <div className="pt-8 border-t border-slate-100">
                <p className="text-xl md:text-2xl text-[#345c72] font-bold italic leading-relaxed max-w-2xl mx-auto">
                  Non è colpa tua.<br /> È che fino ad oggi ti hanno proposto allenamenti pensati per ventenni, non per la nostra meravigliosa età.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

"use client";
import Image from "next/image";
import { CtaRow, CtaWhatsApp } from "../Cta";
import Section from "../Section";
import { site } from "@/content/it";
import Typewriter from "@/components/Typewriter";

export default function Hero() {
  return (
    <Section id="top" className="py-12 md:py-24 overflow-hidden">
      <div className="max-w-4xl mx-auto text-center space-y-12 md:space-y-16">
        {/* Header content */}
        <header className="space-y-8">
          <div className="space-y-3">
            <div className="inline-flex items-center justify-center space-x-2 text-[var(--brand)] font-semibold tracking-widest uppercase text-[10px]">
              <span className="w-6 h-px bg-[var(--brand)]"></span>
              <span>{site.brand}</span>
            </div>
            <h2 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tighter text-[var(--foreground)] leading-none flex items-center justify-center gap-3 md:gap-4 italic whitespace-nowrap">
              <span>FIT</span>
              <span className="text-[var(--brand)] font-light not-italic">&</span>
              <span>smile</span>
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

        {/* Video repositioned here */}
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

        {/* Bottom Text and CTA */}
        <div className="space-y-8 md:space-y-12">
          <div className="space-y-6 text-slate-600/90 leading-relaxed font-light text-lg md:text-xl">
            <p className="max-w-2xl mx-auto">
              Fit & Smile è lo spazio sicuro dove ricominciare a muoverti senza sentirti giudicata,
              dove il tuo ritmo è quello giusto e dove non sei mai sola.
            </p>

            <div className="space-y-2">
              <p className="text-[var(--foreground)] font-medium italic">
                Fit & Smile non è solo allenamento.
              </p>
              <p className="text-3xl md:text-5xl font-black text-[var(--brand)] leading-tight italic">
                È il coraggio di rimetterti <br className="hidden md:block" /> al primo posto.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <span className="inline-flex items-center px-4 py-2 rounded-full bg-slate-100/80 border border-slate-200/50 text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-sm">
                ⌛ 30 Minuti
              </span>
              <span className="inline-flex items-center px-4 py-2 rounded-full bg-slate-100/80 border border-slate-200/50 text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-sm">
                ✨ Risultati in 6 settimane
              </span>
            </div>
          </div>

          <CtaRow className="justify-center">
            <CtaWhatsApp
              phone={site.phone}
              message={site.whatsappMessage}
              className="px-10 py-7 rounded-2xl bg-[var(--foreground)] text-white hover:bg-[var(--brand)] transition-all duration-300 shadow-2xl shadow-black/10 hover:-translate-y-1 active:scale-95 text-lg"
            />
            <a
              href="#metodo"
              className="inline-flex items-center px-10 py-4 text-sm font-bold uppercase tracking-widest text-[var(--foreground)] border-2 border-slate-200 rounded-2xl hover:bg-white hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all duration-300"
            >
              Il Metodo
            </a>
          </CtaRow>
        </div>
      </div>
    </Section>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import Section from "../Section";
import { Button } from "@/components/ui/button";
import { Download, Sparkles, HelpCircle, Play } from "lucide-react";
import confetti from "canvas-confetti";

export default function Metodo() {

  return (
    <Section id="metodo" className="bg-[var(--steel)] text-white">
      <div className="max-w-2xl mb-16">
        <div className="inline-flex items-center gap-2 mb-4">
          <span className="w-8 h-px bg-[var(--brand)]"></span>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--brand)]">Il Metodo</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-6">
          Non siamo qui per correre. <br /> Siamo qui per rinascere.
        </h2>
        <p className="text-slate-300 font-light text-lg italic">
          I tuoi primi passi verso il benessere.
        </p>
      </div>

      {/* Feature Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
        <div className="bg-white border border-slate-100 p-8 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col">
          <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center mb-6">
            <span className="text-orange-400 text-lg">🌿</span>
          </div>
          <h4 className="text-lg font-bold text-[var(--foreground)] mb-2">Inizia qui</h4>
          <p className="text-sm text-slate-500 font-light leading-relaxed mb-6">
            Scarica la guida gratuita per muovere i tuoi primi passi verso il benessere.
          </p>
          <div className="mt-auto">
            <Button className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-all gap-2 group/btn text-xs">
              <Download className="w-4 h-4 transition-transform group-hover/btn:-translate-y-1" />
              Scarica Guida PDF
            </Button>
          </div>
        </div>

        <div className="bg-white border border-slate-100 p-8 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mb-6">
            <span className="text-blue-400 text-lg">🤞</span>
          </div>
          <h4 className="text-lg font-bold text-[var(--foreground)] mb-2">Il Patto dei 10 Minuti</h4>
          <p className="text-sm text-slate-500 font-light leading-relaxed mb-6">
            Non servono ore, bastano 10 minuti di qualità per te stessa ogni giorno.
          </p>
          <div className="mt-auto">
            <Button
              onClick={() => {
                confetti({
                  particleCount: 150,
                  spread: 70,
                  origin: { y: 0.6 },
                  colors: ['#fb923c', '#60a5fa', '#a855f7']
                });
              }}
              className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-all active:scale-95 gap-2 text-xs"
            >
              <Sparkles className="w-4 h-4" />
              Sì, mi dedico 10 min
            </Button>
          </div>
        </div>

        <div className="bg-white border border-slate-100 p-8 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col">
          <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center mb-6">
            <span className="text-purple-400 text-lg">❓</span>
          </div>
          <h4 className="text-lg font-bold text-[var(--foreground)] mb-2">Domande Frequenti</h4>
          <p className="text-sm text-slate-500 font-light leading-relaxed mb-6">
            Hai dubbi o curiosità? Trova subito le risposte alle domande più comuni.
          </p>
          <div className="mt-auto">
            <Button asChild variant="secondary" className="w-full rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold border-none transition-all gap-2 text-xs">
              <Link href="/faq" className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                Vedi tutte le FAQ
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Interactive Video Section: Il Risveglio del Respiro */}
      <div className="mb-24 bg-white/5 border border-white/10 rounded-[2.5rem] p-8 md:p-12 overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32 transition-colors group-hover:bg-emerald-500/20"></div>

        <div className="grid lg:grid-cols-2 gap-12 items-center relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Prova Subito</span>
            </div>
            <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
              Il Risveglio del Respiro <span className="text-emerald-400">(5 Min)</span>
            </h3>
            <p className="text-slate-200 text-xl font-normal leading-relaxed mb-8 italic">
              Fallo ora, anche in pigiama. Premi play e sciogliamo insieme le tensioni del collo.
            </p>
          </div>

          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-900 border border-white/10 group/video cursor-pointer">
            <Image
              src="/metodo/video-thumbnail.jpg" // Placeholder for thumbnail
              alt="Esercizio Risveglio del Respiro"
              fill
              className="object-cover opacity-60 transition-transform duration-700 group-hover/video:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center rounded-full bg-white text-[var(--steel)] shadow-2xl transition-all duration-300 group-hover/video:scale-110 group-hover/video:bg-emerald-400 group-hover/video:text-white">
                <Play className="w-6 h-6 md:w-8 md:h-8 fill-current ml-1" />
              </div>
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/50">
              <span>Durata: 5:00</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                HD Quality
              </span>
            </div>
          </div>
        </div>
      </div>

    </Section>
  );
}

"use client";

import Section from "../Section";
import { MoveRight, Sparkles, Shield, Music } from "lucide-react";
import Link from "next/link";

export default function Metodo() {
  const pillars = [
    {
      id: "noia",
      Icon: Sparkles,
      title: "Stop alla Noia!",
      gate: "01",
      seat: "1A",
      class: "VIP",
      color: "bg-[#345c72] text-[#FBB80F]",
      desc: "Perché si molla la palestra? Perché è sempre uguale. Qui è impossibile: ogni mese cambiamo \"città\", musica e obiettivi. La curiosità di vedere la prossima tappa ti farà essere costante senza nemmeno accorgertene."
    },
    {
      id: "protezione",
      Icon: Shield,
      title: "Protezione Totale",
      gate: "02",
      seat: "1B",
      class: "VIP",
      color: "bg-[#345c72] text-[#FBB80F]",
      desc: "Hai paura di farti male?\nÈ normale.\nQuesto metodo è l'ancora che ti dà stabilità. Zero salti, zero impatti, ma un lavoro profondo per rinforzare ossa e pavimento pelvico in totale sicurezza."
    },
    {
      id: "scintilla",
      Icon: Music,
      title: "La Scintilla",
      gate: "03",
      seat: "1C",
      class: "VIP",
      color: "bg-[#345c72] text-[#FBB80F]",
      desc: "Ginnastica non deve fare rima con sofferenza. Inseriamo passi di Salsa e Bachata perché il tuo corpo va celebrato, non punito. Quando ti diverti, il cervello spegne lo stress e il corpo si sgonfia prima."
    }
  ];

  return (
    <Section id="metodo" className="bg-[#345c72] py-20 px-4">
      <div className="max-w-4xl mx-auto text-center mb-16 space-y-2">
        <div className="inline-flex items-center justify-center space-x-2 text-[var(--brand)] font-semibold tracking-[0.3em] uppercase text-[10px]">
          <span className="w-8 h-px bg-[var(--brand)]"></span>
          <span>Il Mio Metodo</span>
          <span className="w-8 h-px bg-[var(--brand)]"></span>
        </div>
        <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight uppercase italic drop-shadow-lg">
          Perché è diverso?
        </h2>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 justify-items-center">
        {pillars.map((p) => (
          <div key={p.id} className="w-full max-w-[350px] bg-[#fdfaf7] rounded-[32px] border border-[#846047]/10 shadow-xl relative flex flex-col overflow-hidden transition-transform duration-300 hover:scale-[1.02]">
            {/* Cutouts for ticket effect */}
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#345c72] rounded-full border border-[#846047]/10 z-10" />
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#345c72] rounded-full border border-[#846047]/10 z-10" />

            {/* Top Stub */}
            <div className="p-6 pb-4 flex-1 flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <p.Icon className="w-8 h-8 text-[#846047] shrink-0" strokeWidth={1.5} />
                <h3 className="text-xl font-black text-[#2a2e30] italic leading-tight uppercase tracking-tighter">
                  {p.title}
                </h3>
              </div>

              <div className="flex flex-col flex-1">
                <p className="text-[#345c72] text-sm md:text-[15px] font-bold leading-relaxed whitespace-pre-line flex-1">
                  {p.desc.replaceAll('. ', '.\n')}
                </p>

                <div className="flex gap-5 text-[9px] font-mono text-[#846047]/40 mt-6">
                  <div>
                    <span className="block font-bold">GATE</span>
                    <span className="font-bold text-sm text-[#846047]">{p.gate}</span>
                  </div>
                  <div>
                    <span className="block font-bold">SEAT</span>
                    <span className="font-bold text-sm text-[#846047]">{p.seat}</span>
                  </div>
                  <div>
                    <span className="block font-bold">CLASS</span>
                    <span className="font-bold text-sm text-[#846047]">{p.class}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dashed Separator */}
            <div className="px-5">
              <div className="border-t border-dashed border-[#846047]/20 w-full" />
            </div>

            {/* Bottom Stub */}
            <div className="p-6 pt-4 flex flex-col items-center gap-4">
              {/* Barcode-like decoration */}
              <div className="w-full h-6 flex justify-between items-end opacity-10">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="bg-[#2a2e30]" style={{
                    height: `${30 + Math.random() * 70}%`,
                    width: i % 4 === 0 ? '1px' : '3px'
                  }} />
                ))}
              </div>

              <Link href="/pacchetti" className="w-full">
                <button className={`w-full ${p.color} py-3 rounded-xl shadow-md group transition-all hover:brightness-110 active:scale-95 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest animate-pulse-cta`}>
                  PARTI ORA <MoveRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Promise Block */}
      <div className="mt-20 max-w-3xl mx-auto px-4">
        <div className="bg-[#fdfaf7]/90 rounded-[40px] p-10 md:p-12 border border-[#846047]/10 shadow-lg text-center backdrop-blur-sm">
          <p className="text-[#345c72] text-xl md:text-2xl font-black leading-relaxed tracking-tight">
            Un percorso guidato che permette già in <span className="text-[#F46530]">6 settimane</span> di vedere i primi cambiamenti concreti!
          </p>
        </div>
      </div>

      {/* Video Section */}
      <div className="mt-32 max-w-5xl mx-auto px-4">
        <div className="bg-[#f3efec] rounded-[40px] p-8 md:p-16 overflow-hidden relative group shadow-2xl border border-[#846047]/10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--brand)]/5 rounded-full blur-3xl -mr-48 -mt-48"></div>

          <div className="grid lg:grid-cols-2 gap-12 items-center relative z-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F46530]/10 border border-[#F46530]/20 text-[#F46530] text-xs font-bold uppercase tracking-widest">
                Prova Pratica
              </div>
              <h3 className="text-3xl md:text-5xl font-black text-[#2a2e30] leading-tight uppercase italic tracking-tighter">
                Il Risveglio <br /> del Respiro
              </h3>
              <p className="text-[#345c72] text-lg md:text-xl italic font-bold leading-relaxed opacity-80">
                &ldquo;Fallo ora, anche in pigiama. Premi play e sciogliamo insieme le tensioni del collo.&rdquo;
              </p>
            </div>

            <div className="relative aspect-video w-full rounded-[2rem] overflow-hidden bg-black border-4 border-[#345c72]/10 shadow-2xl">
              <video
                src="https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/videos/video_respirazione_landing.mp4"
                controls
                className="w-full h-full object-cover"
                poster="https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/metodo/step-1.png"
              />
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

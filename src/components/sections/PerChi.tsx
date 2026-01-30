"use client";
import Section from "../Section";
import { Check, MoveRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function PerChi() {
  const points = [
    {
      title: "A te che hai sempre messo tutti al primo posto.",
      desc: "Tra casa, lavoro e famiglia, ti sei dimenticata di te stessa. Ora è il momento di recuperare quel tempo, senza sensi di colpa."
    },
    {
      title: "A te che ti senti \"invisibile\" o stravolta.",
      desc: "La menopausa ha cambiato il tuo corpo e il tuo umore. Vuoi guardarti allo specchio e riconoscerti di nuovo, sentendoti bella e vitale."
    },
    {
      title: "A te che pensi \"non è il mio ambiente\".",
      desc: "Hai provato la palestra ma ti sei sentita giudicata o fuori luogo. Qui nessuno ti guarda, nessuno ti giudica. Siamo tutte sulla stessa barca."
    },
    {
      title: "A te che hai paura di farti male.",
      desc: "Vorresti muoverti ma temi per la schiena o le ginocchia. Cerchi qualcuno che ti guidi con dolcezza e competenza, non un sergente che urla."
    }
  ];

  return (
    <Section id="perchi" className="py-24 bg-[#FFFCFC]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Content Area */}
          <div className="space-y-12">
            <div className="space-y-4">
              <h2 className="text-4xl md:text-5xl font-black text-[#2a2e30] leading-tight tracking-tighter uppercase italic">
                Questo Passaporto <br /> è per te se...
              </h2>
              <p className="text-xl text-[#345c72] font-bold italic leading-relaxed">
                Non cerco atlete, cerco donne che vogliono tornare a fiorire.
              </p>
            </div>

            <div className="space-y-8">
              {points.map((p, i) => (
                <div key={i} className="flex gap-4 group">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 transition-transform group-hover:scale-110">
                    <Check className="w-6 h-6" strokeWidth={3} />
                  </div>
                  <div className="space-y-2 pt-1">
                    <h4 className="text-lg md:text-xl font-black text-[#2a2e30] leading-none uppercase tracking-tight">
                      {p.title}
                    </h4>
                    <p className="text-slate-600 text-sm md:text-base leading-relaxed font-medium whitespace-pre-line">
                      {p.desc.replaceAll('. ', '.\n')}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-8 border-t border-slate-100">
              <p className="text-lg md:text-xl text-[#F46530] font-black italic text-center md:text-left">
                Se ti riconosci in anche solo uno di questi punti, sei nel posto giusto. Benvenuta a bordo.
              </p>
            </div>
          </div>

          {/* Visual Elements */}
          <div className="space-y-8">
            <div className="relative">
              <div className="relative aspect-[4/5] rounded-[3rem] overflow-hidden border-8 border-white shadow-2xl">
                <Image
                  src="https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/per-chi/per-chi.png"
                  alt="Benvenuta a Bordo"
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 40vw, 90vw"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent h-1/3" />
              </div>

              {/* Floating Stamp / Detail */}
              <div className="absolute -bottom-6 -right-6 bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 hidden md:block max-w-[200px]">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Punto di Partenza</p>
                <p className="text-sm font-bold text-[#2a2e30]">Il tuo benessere non può più aspettare.</p>
              </div>

              {/* Background Map Detail */}
              <div className="absolute -top-12 -left-12 w-48 h-48 opacity-10 -z-10 animate-pulse">
                <Image src="/images/map-placeholder.svg" alt="" fill className="object-contain" />
              </div>
            </div>

            <Link href="#percorso-dettagli" className="block max-w-sm mx-auto">
              <button className="w-full bg-[#345c72] text-[#FBB80F] py-5 rounded-2xl shadow-xl group transition-all hover:brightness-110 active:scale-95 flex items-center justify-center gap-3 text-lg font-black uppercase tracking-widest animate-pulse-cta">
                PROVA GRATIS <MoveRight className="w-6 h-6 transition-transform group-hover:translate-x-1" />
              </button>
            </Link>
          </div>

        </div>
      </div>
    </Section>
  );
}

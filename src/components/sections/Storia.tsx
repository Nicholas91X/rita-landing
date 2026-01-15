"use client";
import Link from "next/link";
import Section from "../Section";
import { Card } from "@/components/ui/card";
import { storia } from "@/content/it";
import CollapsibleHtml from "@/components/CollapsibleHtml";
import GalleryScroller from "@/components/GalleryScroller";
import { ClipboardList, Dumbbell, House } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Storia() {
  const gallery = [
    "/storia/gal-1.jpg",
    "/storia/gal-2.jpg",
    "/storia/gal-3.jpg",
    "/storia/gal-4.jpg",
    "/storia/gal-5.jpg",
  ];

  return (
    <>
      <Section id="storia" className="bg-[var(--steel)] text-white">
        {/* Titolo fuori dalla grid per allineare il Card all'inizio del testo */}
        <h2 className="h2 text-white">{storia.title}</h2>
        <div className="mt-4 grid md:grid-cols-3 gap-6 items-start">
          <div className="md:col-span-2">
            <CollapsibleHtml
              html={storia.body}
              textColor="text-slate-200"
            />
          </div>
          <Card className="p-6 bg-white/5 border-white/10 backdrop-blur-sm">
            <ul className="text-sm text-slate-200 space-y-2">
              {storia.facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Card>
          {/* Gallery slideshow (1 su sm, 3 su md) */}
          <div className="md:col-span-3 mt-6">
            <GalleryScroller images={gallery} />
          </div>
        </div>
      </Section>

      {/* Nuova sezione "3 Pilastri" con sfondo pieno */}
      <Section id="pilastri" className="bg-[var(--steel)] text-white">
        <div className="rounded-2xl border border-slate-100 bg-white shadow-xl p-6 lg:p-10">
          <h3 className="text-2xl font-bold text-[var(--secondary)] mb-2">
            3 Pilastri per una Menopausa Felice
          </h3>
          <p className="text-[var(--brand)] mb-8 italic font-medium">
            Non è solo fitness. È un approccio scientifico per rispettare i tuoi ormoni.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Box 1 */}
            <div className="bg-slate-50/50 border border-slate-100 p-8 rounded-3xl transition-all duration-300 hover:shadow-md group">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="text-2xl">🌸</span>
              </div>
              <h4 className="text-lg font-bold text-[var(--secondary)] mb-3">Allenamento &ldquo;Energizzante&rdquo;</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                In menopausa, spingere il corpo oltre il limite può causare infiammazione e stanchezza cronica.<br /><br />
                Le mie sessioni sono calibrate per tonificare e riattivare il metabolismo, lasciandoti piena di energia invece che esausta.
              </p>
            </div>

            {/* Box 2 */}
            <div className="bg-slate-50/50 border border-slate-100 p-8 rounded-3xl transition-all duration-300 hover:shadow-md group">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="text-2xl">🛡️</span>
              </div>
              <h4 className="text-lg font-bold text-[var(--secondary)] mb-3">Zero Impatti, Tonificazione Profonda</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                Dimentica i salti che fanno male alle ginocchia.<br /><br />
                Lavoriamo in profondità con Pilates e Total Body controllato per rinforzare le ossa e proteggere il pavimento pelvico.
              </p>
            </div>

            {/* Box 3 */}
            <div className="bg-slate-50/50 border border-slate-100 p-8 rounded-3xl transition-all duration-300 hover:shadow-md group">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="text-2xl">💃</span>
              </div>
              <h4 className="text-lg font-bold text-[var(--secondary)] mb-3">Muoversi col Sorriso</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                Il benessere passa dal cervello.<br /><br />
                Integro lezioni base di <strong>Salsa e Bachata</strong> per migliorare la coordinazione, l'umore e farti dimenticare che ti stai &ldquo;allenando&rdquo;.
              </p>
            </div>
          </div>

          <div className="bg-[var(--steel)]/5 rounded-2xl p-6 border border-[var(--steel)]/10">
            <p className="text-slate-600 leading-relaxed text-sm md:text-base text-center">
              Un percorso guidato che permette già in <strong className="text-[var(--brand)]">6 settimane</strong> di vedere i primi cambiamenti concreti!
            </p>
          </div>
        </div>
      </Section>

      {/* Sezione con due card affiancate */}
      <Section id="percorso-dettagli" className="bg-slate-50">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--secondary)] mb-4">
            Come vuoi iniziare a prenderti cura di te?
          </h2>
          <p className="text-slate-600 text-lg">
            Scegli la strada più adatta ai tuoi obiettivi e al tuo tempo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-[#FCF5E8] p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-xl hover:shadow-2xl transition-all flex flex-col h-full relative overflow-hidden group">
            <div className="absolute top-0 right-0 bg-[var(--brand)] text-white text-[10px] font-bold uppercase tracking-widest px-6 py-2 rounded-bl-2xl">
              Al Tuo Ritmo
            </div>

            <h4 className="text-xl font-bold text-[var(--secondary)] mb-2 mt-6 uppercase tracking-tight">Rinascita Club (Mensile)</h4>
            <p className="text-[var(--brand)] font-bold text-sm mb-6">
              La tua palestra digitale completa, accessibile h24.
            </p>

            <div className="space-y-4 mb-8 flex-grow">
              <div className="flex gap-3">
                <span className="text-emerald-500 font-bold">✅</span>
                <p className="text-sm text-slate-600"><strong className="text-slate-900">Accesso Illimitato:</strong> Accesso completo all'abbonamento per 30 giorni.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-emerald-500 font-bold">✅</span>
                <p className="text-sm text-slate-600"><strong className="text-slate-900">Percorsi Graduali:</strong> Filtra subito tra livello Principiante o Intermedio.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-emerald-500 font-bold">✅</span>
                <p className="text-sm text-slate-600"><strong className="text-slate-900">Doppia Disciplina:</strong> Alterna Total Body e Pilates quando vuoi.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-emerald-500 font-bold">✅</span>
                <p className="text-sm text-slate-600"><strong className="text-slate-900">BONUS ESCLUSIVO:</strong> Lezioni di Salsa Cubana e Bachata per divertirti.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-emerald-500 font-bold">✅</span>
                <p className="text-sm text-slate-600"><strong className="text-slate-900">Nessun Vincolo:</strong> Disdici quando vuoi con un click.</p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-50 mt-auto">
              <div className="flex items-baseline gap-3 mb-10">
                <span className="text-slate-400 line-through decoration-red-500 decoration-2 text-lg">30 €</span>
                <span className="text-3xl font-bold text-[var(--secondary)]">19,99€</span>
                <span className="text-slate-500 text-sm">/ mese</span>
              </div>

              <Button asChild className="w-full bg-[var(--steel)] hover:bg-[var(--steel)]/90 text-[var(--accent)] rounded-2xl py-6 h-auto text-lg font-bold shadow-lg shadow-blue-900/10 transition-transform active:scale-95">
                <Link href="/login" className="cursor-pointer">
                  Inizia la Prova Gratuita
                </Link>
              </Button>
            </div>
          </div>

          <div className="bg-[#FCF5E8] p-8 md:p-10 rounded-[2.5rem] border border-[var(--brand)] shadow-xl hover:shadow-2xl transition-all flex flex-col h-full relative overflow-hidden group">
            <div className="absolute top-0 right-0 bg-[var(--brand)] text-white text-[10px] font-bold uppercase tracking-widest px-6 py-2 rounded-bl-2xl">
              Mano nella Mano
            </div>

            <h4 className="text-xl font-bold text-[var(--secondary)] mb-2 mt-6 uppercase tracking-tight">Percorso Rinascita Guidata (6 Settimane)</h4>
            <p className="text-[var(--brand)] font-bold text-sm mb-6">
              Un programma costruito sartorialmente sul TUO corpo e sulla tua storia.
            </p>

            <div className="space-y-4 mb-8 flex-grow">
              <div className="flex gap-3">
                <span className="text-emerald-500 font-bold">✅</span>
                <p className="text-sm text-slate-600"><strong className="text-slate-900">Consulenza Iniziale:</strong> Una Call di 30 minuti diretta con me per analizzare la tua situazione.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-emerald-500 font-bold">✅</span>
                <p className="text-sm text-slate-600"><strong className="text-slate-900">Strategia Sartoriale:</strong> Creazione di 2 Schede di Allenamento specifiche per le tue esigenze.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-emerald-500 font-bold">✅</span>
                <p className="text-sm text-slate-600"><strong className="text-slate-900">Monitoraggio:</strong> Supporto dedicato per 6 settimane per correggere il tiro.</p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-50 mt-auto">
              <div className="flex items-baseline gap-3 mb-10">
                <span className="text-slate-400 line-through decoration-red-500 decoration-2 text-lg">85 €</span>
                <span className="text-3xl font-bold text-[var(--secondary)]">59,99€</span>
                <span className="text-slate-500 text-sm">/ percorso</span>
              </div>

              <Button asChild className="w-full bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white rounded-2xl py-6 h-auto text-lg font-bold shadow-lg shadow-amber-900/10 transition-transform active:scale-95">
                <Link href="/login" className="cursor-pointer">
                  Sì, voglio essere guidata
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

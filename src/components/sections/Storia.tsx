"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Section from "../Section";
import { Card, CardContent } from "@/components/ui/card";
import { storia } from "@/content/it";
import CollapsibleHtml from "@/components/CollapsibleHtml";
import GalleryScroller from "@/components/GalleryScroller";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { Calendar, Users, Clock, Dumbbell, Sparkles, CheckCircle2 } from "lucide-react";
import Image from "next/image";

export default function Storia({
  isLoggedIn: initialIsLoggedIn = false,
  hasUsedTrial: initialHasUsedTrial = false
}: {
  isLoggedIn?: boolean,
  hasUsedTrial?: boolean
}) {
  const [isLoggedIn, setIsLoggedIn] = useState(initialIsLoggedIn);
  const [hasUsedTrial, setHasUsedTrial] = useState(initialHasUsedTrial);

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      setIsLoggedIn(!!user);

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('has_used_trial')
          .eq('id', user.id)
          .single();

        if (profile) {
          setHasUsedTrial(profile.has_used_trial);
        }
      }
    };
    checkUser();
  }, []);

  const gallery = [
    "https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/metodo/step-1.png",
    "https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/metodo/step-2.png",
    "https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/metodo/step-3.png",
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
                Integro lezioni base di <strong>Salsa e Bachata</strong> per migliorare la coordinazione, l&apos;umore e farti dimenticare che ti stai &ldquo;allenando&rdquo;.
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
          {/* Card 1: Subscription */}
          <Card className="bg-white border-none shadow-xl hover:shadow-2xl transition-all duration-500 rounded-[32px] overflow-hidden flex flex-col group">
            {/* Promo Banner */}
            <div className="bg-[#593e25] text-white py-3 px-6 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-white/80" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em]">Offerta a tempo limitato</span>
            </div>
            <div className="relative h-64 overflow-hidden">
              <Image
                src="https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/side/left-2.png"
                alt="Rinascita Club"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-black/10" />
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md text-[var(--brand)] text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-lg">
                Al Tuo Ritmo
              </div>
            </div>

            <CardContent className="p-8 md:p-10 space-y-6 flex-1 flex flex-col">
              <div>
                <h4 className="text-2xl font-bold text-[var(--secondary)] leading-tight mb-2">
                  Passaporto Fit & Smile (Mensile)
                </h4>
                <p className="text-sm text-slate-500 leading-relaxed italic">
                  La tua carta d&apos;imbarco per tutte le destinazioni del benessere. 🌿
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 text-slate-400 text-sm font-medium">
                  <Clock className="w-4 h-4" />
                  <span>Accesso Illimitato 24/7</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400 text-sm font-medium">
                  <Dumbbell className="w-4 h-4" />
                  <span>Principiante & Intermedio</span>
                </div>
              </div>

              <div className="space-y-4 py-4">
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-sm text-slate-600">Accesso completo per 30 giorni</p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-sm text-slate-600">Total Body & Pilates</p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-sm text-slate-600"><strong>BONUS:</strong> Salsa Cubana & Bachata</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 mt-auto">
                <div className="flex -space-x-2.5">
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-neutral-200" />
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-neutral-300" />
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-neutral-400" />
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-[#f3efec] text-[9px] font-black text-neutral-500">
                    +1.2k
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline gap-2">
                    <span className="text-slate-300 line-through text-sm font-bold">30€</span>
                    <span className="text-3xl font-black text-[var(--secondary)]">19,99€</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sottoscrizione Mensile</p>
                </div>
              </div>

              {isLoggedIn && hasUsedTrial && (
                <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">ℹ️</span>
                  <p className="text-[10px] text-amber-700 font-medium leading-tight">
                    Hai già usufruito del tuo periodo di prova gratuito. L&apos;abbonamento si attiverà immediatamente al costo indicato.
                  </p>
                </div>
              )}

              <Button asChild className="w-full bg-[var(--steel)] hover:bg-[var(--steel)]/90 text-[var(--accent)] rounded-2xl py-6 h-auto text-lg font-bold shadow-lg shadow-blue-900/10 transition-transform active:scale-95">
                <Link href={isLoggedIn ? "/dashboard?tab=training&packageId=trial" : "/login"} className="cursor-pointer">
                  Inizia la Prova Gratuita
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: Guided Path */}
          <Card className="bg-white border-2 border-[var(--brand)] shadow-2xl hover:shadow-2xl transition-all duration-500 rounded-[32px] overflow-hidden flex flex-col group relative">
            {/* Promo Banner */}
            <div className="bg-[#593e25] text-white py-3 px-6 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-white/80" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em]">Offerta a tempo limitato</span>
            </div>
            <div className="relative h-64 overflow-hidden">
              <Image
                src="https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/side/right-2.png"
                alt="Rinascita Guidata"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-black/10" />
              <div className="absolute top-4 right-4 bg-[var(--brand)] text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-lg">
                Mano nella Mano
              </div>
            </div>

            <CardContent className="p-8 md:p-10 space-y-6 flex-1 flex flex-col">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-[var(--brand)]" />
                  <span className="text-[10px] font-bold text-[var(--brand)] uppercase tracking-widest">Percorso Premium</span>
                </div>
                <h4 className="text-2xl font-bold text-[var(--secondary)] leading-tight mb-2">
                  Rinascita Guidata (6 Settimane)
                </h4>
                <p className="text-sm text-slate-500 leading-relaxed italic">
                  Un programma costruito sartorialmente sul TUO corpo.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 text-slate-400 text-sm font-medium">
                  <Calendar className="w-4 h-4" />
                  <span>Durata 6 Settimane</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400 text-sm font-medium">
                  <Users className="w-4 h-4" />
                  <span>Supporto 1:1 Dedicato</span>
                </div>
              </div>

              <div className="space-y-4 py-4">
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[var(--brand)] shrink-0" />
                  <p className="text-sm text-slate-600"><strong>Call di 30 min</strong> diretta con me</p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[var(--brand)] shrink-0" />
                  <p className="text-sm text-slate-600">2 Schede di Allenamento specifica</p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[var(--brand)] shrink-0" />
                  <p className="text-sm text-slate-600">Monitoraggio e correzione costante</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 mt-auto">
                <div className="flex -space-x-2.5">
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-neutral-200" />
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-neutral-300" />
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-[#f3efec] text-[9px] font-black text-neutral-500">
                    +420
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline gap-2">
                    <span className="text-slate-300 line-through text-sm font-bold">85€</span>
                    <span className="text-3xl font-black text-[var(--brand)]">59,99€</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Una Tantum</p>
                </div>
              </div>

              <Button asChild className="w-full bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white rounded-2xl py-6 h-auto text-lg font-bold shadow-lg shadow-amber-900/10 transition-transform active:scale-95">
                <Link href={isLoggedIn ? "/dashboard?tab=1to1" : "/login"} className="cursor-pointer">
                  Sì, voglio essere guidata
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Section>
    </>
  );
}

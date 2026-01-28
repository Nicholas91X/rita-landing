import type { Metadata } from "next";
import Section from "@/components/Section";

import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CtaRow, CtaWhatsApp } from "@/components/Cta";
import { site } from "@/content/it";
import { Dumbbell } from "lucide-react";
import SideMarquees from "@/components/SideMarquees";
import Link from "next/link";
import { getPublicContentHierarchy } from "../actions/content";

const leftImgs = [
  "https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/side/left-1.png",
  "https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/side/left-2.png",
  "https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/side/left-3.png",
  "https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/side/left-4.png",
];

const rightImgs = [
  "https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/side/right-1.png",
  "https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/side/right-2.png",
  "https://hel1.your-objectstorage.com/nicholas-bucket/rita-zanicchi/side/right-3.png",
];

export const metadata: Metadata = {
  title: "Pacchetti e prezzi | Rita Zanicchi PT",
  description:
    "Scopri i pacchetti di coaching personalizzato di Rita Zanicchi: Start, Progress e Signature con formule su misura per il tuo ritmo.",
  alternates: {
    canonical: "/pacchetti",
  },
};

export default async function PackagesPage() {
  const levels = await getPublicContentHierarchy();

  // Helper per estrarre tutti i pacchetti in una lista piatta o raggruppata
  // Qui manteniamo la struttura visuale a griglia.
  // Se vogliamo mostrare tutto piatto, possiamo fare flatMap.
  // Ma preserviamo la logica 'livello' se ha senso, o appiattiamo.
  // L'utente chiede "tutti i pacchetti disponibili".

  const allPackages = levels.flatMap(level =>
    level.courses.flatMap(course =>
      course.packages.map(pkg => ({
        ...pkg,
        levelName: level.name,
        courseName: course.name
      }))
    )
  );

  return (
    <main className="relative bg-[var(--bg)] text-[var(--foreground)]">
      <SideMarquees
        left={leftImgs}
        right={rightImgs}
        width={240}
        gap={12}
        speedSec={22}
      />
      <div className="max-w-7xl mx-auto py-12 md:py-20 text-[var(--secondary)]">
        <Section className="section">
          <div className="grid gap-10 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)] items-center">
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted-foreground)]">
                Pacchetti coaching
              </p>
              <h1 className="h1 text-[var(--secondary)]">
                Scegli il tuo percorso
              </h1>
              <p className="text-lg lead text-[var(--secondary)]">
                Dai primi passi al perfezionamento tecnico.
                Trova il pacchetto adatto al tuo livello e inizia ad allenarti oggi stesso.
              </p>
              <CtaRow>
                <CtaWhatsApp
                  phone={site.phone}
                  message="Ciao Rita! Vorrei capire quale pacchetto fa per me."
                  className="w-full justify-center sm:w-auto"
                >
                  Chiedi un consiglio
                </CtaWhatsApp>
              </CtaRow>
            </div>

            {/* Info Box */}
            <div className="panel p-8 border-[var(--border)] shadow-lg backdrop-blur-md bg-[var(--panel)]/80">
              <div className="flex items-center gap-3 mb-4">
                <Dumbbell className="h-6 w-6 text-[var(--brand)]" />
                <p className="text-sm font-semibold text-[var(--accent-foreground)] uppercase tracking-wide">
                  Come iniziare
                </p>
              </div>
              <ul className="space-y-4 text-sm">
                <li className="flex gap-3">
                  <span className="font-semibold text-[var(--brand)]">1.</span>
                  <span>
                    Scegli il pacchetto che preferisci qui sotto.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-[var(--brand)]">2.</span>
                  <span>
                    Acquista in sicurezza tramite Stripe.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-[var(--brand)]">3.</span>
                  <span>
                    Accedi subito alla tua Area Riservata e inizia ad allenarti.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </Section>

        {/* Dynamic Packages Grid */}
        <Section className="section mt-20">
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {allPackages.map((pkg) => (
              <Card
                key={pkg.id}
                className="h-full border-[var(--border)] bg-[var(--panel)] text-[var(--accent-foreground)] backdrop-blur transition-all duration-200 shadow-lg hover:shadow-xl hover:border-[var(--brand)]/50 overflow-hidden group"
              >
                <div className="h-40 w-full relative overflow-hidden">
                  {pkg.image_url ? (
                    <div className="relative w-full aspect-video">
                      <Image
                        src={pkg.image_url || "https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=2070&auto=format&fit=crop"}
                        alt={pkg.name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full bg-neutral-900/50 flex items-center justify-center">
                      <Dumbbell className="w-10 h-10 text-white/5" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute top-0 left-0 w-full h-1 bg-[var(--brand)]" />
                </div>
                <CardHeader className="border-b border-[var(--border)] pb-6 pt-6">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-[var(--brand)] mb-2 font-bold">
                      {pkg.levelName} - {pkg.courseName}
                    </div>
                    <CardTitle className="text-2xl font-bold text-[var(--foreground)]">
                      {pkg.name}
                      {pkg.name?.toUpperCase().includes("BALI") && " 🍹"}
                      {pkg.name?.toUpperCase().includes("NEW YORK") && " 🗽"}
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-700 mt-2 line-clamp-3">
                      {pkg.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 py-6">
                  <div>
                    <p className="text-4xl font-extrabold text-[var(--brand)]">
                      {pkg.price ? `€${pkg.price}` : 'Gratis'}
                    </p>
                    <p className="text-xs text-gray-600 uppercase mt-1">
                      Accesso completo
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="mt-auto pb-6">
                  <div className="w-full">
                    <Link
                      href={`/dashboard?packageId=${pkg.id}`}
                      className="inline-flex w-full items-center justify-center rounded-full bg-[var(--foreground)] px-4 py-3 text-sm font-semibold text-[var(--background)] transition-transform hover:scale-[1.02] hover:opacity-90 active:scale-[0.98]"
                    >
                      Vai al pacchetto
                    </Link>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>

          {allPackages.length === 0 && (
            <div className="text-center py-20 text-[var(--muted-foreground)]">
              Al momento non ci sono pacchetti disponibili. Torna a trovarci presto!
            </div>
          )}
        </Section>

        <Section className="section mt-12">
          <div className="panel p-8 md:p-12 text-center space-y-6 border-[var(--border)] bg-[var(--panel)]/50">
            <h2 className="h2 text-[var(--accent-foreground)]">Hai dubbi o esigenze particolari?</h2>
            <p className="mx-auto max-w-2xl text-[var(--accent-foreground)]">
              Possiamo costruire un percorso completamente personalizzato anche
              oltre i pacchetti indicati.
            </p>
            <CtaRow>
              <CtaWhatsApp
                phone={site.phone}
                message={site.whatsappMessage}
                className="w-full justify-center sm:w-auto"
              >
                Prenota una consulenza gratuita
              </CtaWhatsApp>
            </CtaRow>
          </div>
        </Section>
      </div>
    </main>
  );
}

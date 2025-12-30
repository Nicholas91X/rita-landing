import type { Metadata } from "next";
import Section from "@/components/Section";
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
import { Check } from "lucide-react";
import SideMarquees from "@/components/SideMarquees";

const leftImgs = [
  "/side/left-1.jpg",
  "/side/left-2.jpg",
  "/side/left-3.jpg",
  "/side/left-4.jpg",
  "/side/left-5.jpg",
];

const rightImgs = [
  "/side/right-1.jpg",
  "/side/right-2.jpg",
  "/side/right-3.jpg",
  "/side/right-4.jpg",
  "/side/right-5.jpg",
];

const packages = [
  {
    name: "Start 6 Weeks",
    price: "\u20AC149",
    billing: "Percorso intensivo di 6 settimane",
    description: "Riparti dalle basi e crea una routine sostenibile.",
    duration: "6 settimane",
    features: [
      "Colloquio iniziale di valutazione (30 minuti)",
      "Programma di allenamento personalizzato con 3 sessioni a settimana",
      "Video tutorial degli esercizi con correzioni tecniche",
      "Supporto chat asincrono dal lunedi al venerdi",
    ],
    cta: "Prenota lo Start",
  },
  {
    name: "Progress 12 Weeks",
    price: "\u20AC279",
    billing: "Accompagnamento completo per 3 mesi",
    description:
      "Stabilizza i risultati e lavora sulla forma fisica nel lungo periodo.",
    duration: "12 settimane",
    features: [
      "Call di allineamento ogni 2 settimane",
      "Doppio programma mensile con progressione guidata",
      "Integrazione piano mobilita e recupero",
      "Revisione alimentare di base con diario condiviso",
      "Supporto chat rapido entro 24 ore",
    ],
    highlight: true,
    cta: "Voglio il Progress",
  },
  {
    name: "Signature Coaching",
    price: "\u20AC449",
    billing: "Percorso premium su misura",
    description:
      "Coaching individuale totale per obiettivi specifici e timeline serrate.",
    duration: "3 mesi rinnovabili",
    features: [
      "Assessment funzionale in presenza o live",
      "Programma personalizzato aggiornato ogni settimana",
      "Sessioni one-to-one mensili (60 minuti)",
      "Analisi video illimitata con feedback entro 12 ore",
      "Coordinamento con specialisti esterni su richiesta",
    ],
    cta: "Parliamo della Signature",
  },
] as const;

export const metadata: Metadata = {
  title: "Pacchetti e prezzi | Rita Zanicchi PT",
  description:
    "Scopri i pacchetti di coaching personalizzato di Rita Zanicchi: Start, Progress e Signature con formule su misura per il tuo ritmo.",
  alternates: {
    canonical: "/pacchetti",
  },
};

export default function PackagesPage() {
  return (
    <main className="relative">
      <SideMarquees
        left={leftImgs}
        right={rightImgs}
        width={240}
        gap={12}
        speedSec={22}
      />
      <div className="max-w-6xl mx-auto px-8 md:px-10 lg:px-26 xl:px-26">
        <Section className="section">
          <div className="grid gap-10 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)] items-center">
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted-foreground)]">
                Pacchetti coaching
              </p>
              <h1 className="h1 text-white ts-white">
                Scegli il ritmo giusto per te
              </h1>
              <p className="text-lg lead">
                Ogni percorso nasce dall'ascolto delle tue esigenze, dal tempo
                che hai a disposizione e dal risultato che vuoi raggiungere.
                Tutti i pacchetti includono il mio supporto personale e la
                possibilita di adattare il carico settimanale.
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
            <div className="panel p-8 border-[var(--border)] shadow-lg">
              <p className="text-sm font-semibold text-[var(--accent-foreground)] uppercase tracking-wide">
                Come funziona
              </p>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="font-semibold text-[var(--brand)]">1.</span>
                  <span>
                    Compili il questionario iniziale e mi racconti obiettivi,
                    disponibilita e eventuali limitazioni.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-[var(--brand)]">2.</span>
                  <span>
                    Definiamo il percorso piu adatto e ricevi il tuo primo
                    programma personalizzato.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-[var(--brand)]">3.</span>
                  <span>
                    Restiamo in contatto costante per monitorare progressi e
                    modulare allenamenti e recupero.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </Section>

        <Section className="section">
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {packages.map((pkg) => (
              <Card
                key={pkg.name}
                className={`h-full border-[var(--border)] bg-[var(--panel)] text-[var(--accent-foreground)] backdrop-blur transition-all duration-200 ${
                  pkg.highlight
                    ? "ring-2 ring-[var(--brand)] shadow-2xl md:-translate-y-2"
                    : "shadow-lg"
                }`}
              >
                <CardHeader className="border-b border-white/30 pb-6">
                  <div>
                    <CardTitle className="text-2xl font-bold text-white">
                      {pkg.name}
                    </CardTitle>
                    <CardDescription className="text-sm text-[var(--muted-foreground)]">
                      {pkg.description}
                    </CardDescription>
                  </div>
                  <div className="text-right text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    {pkg.duration}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 py-6">
                  <div>
                    <p className="text-4xl font-extrabold text-[var(--brand)]">
                      {pkg.price}
                    </p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {pkg.billing}
                    </p>
                  </div>
                  <ul className="space-y-3 text-sm">
                    {pkg.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="mt-1 h-4 w-4 text-[var(--brand)]" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="mt-auto pb-6">
                  <CtaWhatsApp
                    phone={site.phone}
                    message={`Ciao Rita! Vorrei attivare il pacchetto ${pkg.name}.`}
                    className="w-full justify-center"
                  >
                    {pkg.cta}
                  </CtaWhatsApp>
                </CardFooter>
              </Card>
            ))}
          </div>
        </Section>

        <Section className="section">
          <div className="panel p-8 md:p-12 text-center space-y-6 border-[var(--border)]">
            <h2 className="h2 text-[var(--accent-foreground)]">Hai dubbi o esigenze particolari?</h2>
            <p className="mx-auto max-w-2xl text-[var(--accent-foreground)]">
              Possiamo costruire un percorso completamente personalizzato anche
              oltre i pacchetti indicati. Raccontami da dove parti, che
              risultati desideri e troviamo la strategia migliore per te.
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

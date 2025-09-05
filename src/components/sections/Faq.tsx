"use client";
import Section from "../Section";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Come funziona il mio metodo?",
    a: (
      <>
        <p>
          <strong className="text-black">In 3 step</strong> semplici e concreti:
        </p>
        <ol className="mt-2 space-y-2 list-decimal pl-5">
          <li>
            <strong className="text-black">Consulenza gratuita (30–40’)</strong> – poche domande per
            conoscerti e chiarire i tuoi <strong>obiettivi</strong>, più piccoli
            test fisici per valutare la tua condizione di partenza.
          </li>
          <li>
            <strong className="text-black">Protocollo personalizzato</strong> – un allenamento su
            misura con <strong>2 o 3 sedute a settimana da 30’</strong>, pensate
            per darti il massimo risultato nel tempo che hai davvero.
          </li>
          <li>
            <strong className="text-black">Compiti a casa</strong> – micro-abitudini quotidiane, facili
            e sostenibili, per eliminare le cattive abitudini e consolidare i
            progressi.
          </li>
        </ol>
      </>
    ),
  },
  {
    q: "Quanto dura una seduta?",
    a: "Circa 30 minuti: allenamenti brevi, mirati ed efficaci.",
  },
  {
    q: "Quando vedo i primi risultati?",
    a: "In circa 6 settimane seguendo il protocollo (2 o 3 sedute personalizzate da 30’ ciascuna).",
  },
  {
    q: "Devo essere già allenata?",
    a: "No. Il percorso è costruito sul tuo livello attuale e cresce insieme a te.",
  },
  {
    q: "Dove si svolgono le lezioni?",
    a: (
      <>
        <p>
          <strong className="text-black">Online (consigliato se hai poco tempo):</strong> sessioni in
          videochiamata e programma personalizzato con feedback continui —
          massima flessibilità, zero spostamenti.
        </p>
        <p className="mt-2">
          <strong className="text-black">In presenza:</strong> presso <em>Palestra Pegaso</em> (Via
          Ameglia, 74 – Romito Magra, SP) con ampio parcheggio.
        </p>
      </>
    ),
  },
];

export default function Faq() {
  return (
    <Section id="faq">
      <h2 className="text-3xl md:text-4xl font-extrabold text-center">FAQ</h2>
      <Accordion type="single" collapsible className="mt-8 max-w-3xl mx-auto">
        {faqs.map(({ q, a }, i) => (
          <AccordionItem key={i} value={`item-${i}`}>
            <AccordionTrigger className="text-lg md:text-xl font-semibold">
              {q}
            </AccordionTrigger>
            <AccordionContent className="text-[var(--muted-foreground)] leading-relaxed space-y-2">
              {a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
}

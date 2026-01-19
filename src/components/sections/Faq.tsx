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
    q: "Che tipo di esercizi sono inclusi nei corsi di Fit & Smile?",
    a: "Il programma combina esercizi di Pilates e allenamento total body studiati per migliorare mobilità, circolazione, tonificazione ed energia. Inoltre, il ballo ispirato alle danze caraibiche viene integrato insieme agli altri esercizi per migliorare coordinazione, ritmo e resistenza.",
  },
  {
    q: "Sono adatti a chi non ha mai frequentato una palestra tradizionale?",
    a: (
      <>
        <p className="mb-2">
          Assolutamente sì. <strong className="text-black">Fit & Smile</strong> è
          stato creato per donne che non si sono mai allenate, o hanno iniziato da
          poco ma non amano le palestre e cercano un programma adatto a loro.
        </p>
        <p>
          Tutte le sessioni sono strutturate con spiegazioni dettagliate e un
          approccio graduale che rende l’esperienza accessibile anche a chi è alle
          prime armi.
        </p>
      </>
    ),
  },
  {
    q: "Quali benefici posso aspettarmi partecipando a Fit & Smile?",
    a: (
      <>
        <p className="mb-2">Partecipando al programma potrai:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Migliorare mobilità, circolazione, tonificazione e livelli di energia
            grazie a esercizi studiati appositamente per le esigenze delle donne
            over 45.
          </li>
          <li>
            Sperimentare l’integrazione del ballo, che aggiunge divertimento,
            coordinazione e ritmo all’allenamento.
          </li>
          <li>
            Godere di un ambiente sicuro e di supporto, dove ogni sessione diventa
            un appuntamento di benessere e rigenerazione fisica e psicologica.
          </li>
        </ul>
      </>
    ),
  },
  {
    q: "Quanto dura una lezione?",
    a: "Ogni sessione dura massimo 30 minuti e puoi fermarla e riprendere quando vuoi.",
  },
  {
    q: "Posso disdire quando voglio?",
    a: "Certamente! Puoi disdire quando vuoi e avrai accesso al tuo abbonamento sino alla fine del mese acquistato.",
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

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
    q: "Quanto dura una seduta?",
    a: "Circa 30 minuti, efficace e sostenibile.",
  },
  {
    q: "Quando vedo risultati?",
    a: "In ~6 settimane seguendo percorso e compiti.",
  },
  {
    q: "Devo essere allenata?",
    a: "No, il protocollo è costruito sul tuo livello.",
  },
];

export default function Faq() {
  return (
    <Section id="faq">
      <h2 className="text-3xl md:text-4xl font-extrabold text-center">FAQ</h2>
      <Accordion type="single" collapsible className="mt-8 max-w-3xl mx-auto">
        {faqs.map(({ q, a }, i) => (
          <AccordionItem key={i} value={`item-${i}`}>
            <AccordionTrigger>{q}</AccordionTrigger>
            <AccordionContent>{a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
}

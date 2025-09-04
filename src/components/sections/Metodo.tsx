import Section from "../Section";
import { Card } from "@/components/ui/card";

export default function Metodo() {
  const steps = [
    { t: "1) Consulenza gratuita", d: "Anamnesi e piccoli test (30–40')." },
    {
      t: "2) Protocollo personalizzato",
      d: "2 o 3 allenamenti settimanali da 30'.",
    },
    {
      t: "3) Compiti a casa",
      d: "Micro‑abitudini quotidiane per accelerare i risultati.",
    },
  ];
  return (
    <Section id="metodo">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-extrabold">
          Il mio metodo in 3 step
        </h2>
        <p className="mt-3 text-[var(--muted-foreground)]">
          Allenamenti personalizzati, brevi ed efficaci.
        </p>
      </div>
      <div className="mt-10 grid md:grid-cols-3 gap-6">
        {steps.map(({ t, d }) => (
          <Card
            key={t}
            className="p-6 bg-[var(--accent-foreground)] border-0 text-white"
          >
            <h3 className="text-xl font-semibold">{t}</h3>
            <p className="mt-2 text-[var(--muted-foreground)]">{d}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

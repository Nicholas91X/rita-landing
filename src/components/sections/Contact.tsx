import Section from "../Section";
import { Button } from "@/components/ui/button";
import Socials from "../Socials";

export default function Contact() {
  return (
    <Section id="contatti">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--foreground)]">Contatti</h2>

        <p className="text-lg md:text-xl text-[var(--muted-foreground)] leading-relaxed">
          Se hai dubbi o domande, scrivimi pure. <br />
          Sarò lieta di risponderti ☺️
        </p>

        <div className="flex justify-center">
          <Button asChild size="lg" className="rounded-full px-8 py-6 text-lg bg-[var(--brand)] hover:bg-[var(--brand-2)] text-white shadow-xl shadow-[var(--brand)]/20 transition-all hover:-translate-y-1">
            <a
              href="https://wa.me/393472292627?text=Ciao%20Rita%21%20Vorrei%20una%20consulenza."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              Scrivimi su WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </Section>
  );
}

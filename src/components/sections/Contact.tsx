import Section from "../Section";
import { Button } from "@/components/ui/button";
import Socials from "../Socials";

export default function Contact() {
  return (
    <Section id="contatti">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="pr-2">
          <h2 className="text-3xl md:text-4xl font-extrabold">Contatti</h2>
          <div className="mt-4 space-y-2 text-[var(--foreground)]">
            <p>
              <strong>Email:</strong>
              <a
                className="underline text-[var(--muted-foreground)]"
                href="mailto:ritazanicchi73@libero.it"
              >
                ritazanicchi73@libero.it
              </a>
            </p>
            <p>
              <strong>Telefono:</strong>
              <a
                className="underline text-[var(--muted-foreground)]"
                href="tel:+393472292627"
              >
                +39 347 229 2627
              </a>
            </p>
            <p>
              <strong>Indirizzo:</strong>
              <span className="text-[var(--muted-foreground)]">
                Palestra Pegaso · Via Ameglia, 74 · Romito Magra (SP) 19021
              </span>
            </p>
            <Button asChild className="mt-2">
              <a
                className="inline-flex items-center rounded-full px-5 py-3 text-sm font-medium
               bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 border-1 border-black"
                href="https://wa.me/393472292627?text=Ciao%20Rita%21%20Vorrei%20una%20consulenza."
              >
                Scrivimi su WhatsApp
              </a>
            </Button>

            <div className="mt-4">
              <Socials variant="dark" />
            </div>
          </div>
        </div>
        <div className="h-72 rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-2">
          <iframe
            title="Mappa Palestra Pegaso"
            className="w-full h-full rounded-2xl"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src="https://www.google.com/maps?q=Via%20Ameglia%2C%2074%2C%20Romito%20Magra%20(SP)&output=embed"
          />
        </div>
      </div>
    </Section>
  );
}

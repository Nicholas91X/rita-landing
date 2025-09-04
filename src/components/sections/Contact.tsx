import Section from "../Section";
import { Button } from "@/components/ui/button";

export default function Contact() {
  return (
    <Section id="contatti">
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-3xl md:text-4xl font-extrabold">Contatti</h2>
          <div className="mt-4 space-y-2 text-slate-700">
            <p>
              <strong>Email:</strong>{" "}
              <a className="underline" href="mailto:ritazanicchi73@libero.it">
                ritazanicchi73@libero.it
              </a>
            </p>
            <p>
              <strong>Telefono:</strong>{" "}
              <a className="underline" href="tel:+393472292627">
                +39 347 229 2627
              </a>
            </p>
            <p>
              <strong>Indirizzo:</strong> Palestra Pegaso · Via Ameglia, 74 ·
              Romito Magra (SP) 19021
            </p>
            <Button asChild className="mt-2">
              <a href="https://wa.me/393472292627?text=Ciao%20Rita%21%20Vorrei%20una%20consulenza.">
                Scrivimi su WhatsApp
              </a>
            </Button>
          </div>
        </div>
        <div className="h-72 rounded-3xl border bg-white/70 p-2">
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

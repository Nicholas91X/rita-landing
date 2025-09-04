"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const CTA_WA =
  "https://wa.me/393472292627?text=Ciao%20Rita%2C%20vorrei%20prenotare%20una%20consulenza%20gratuita";

export default function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b bg-white/70 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
        <Link href="#top" className="font-semibold tracking-tight">
          Rita Zanicchi · PT
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <a href="#metodo" className="hover:opacity-80">
            Metodo
          </a>
          <a href="#faq" className="hover:opacity-80">
            FAQ
          </a>
          <a href="#contatti" className="hover:opacity-80">
            Contatti
          </a>
        </nav>
        <Button asChild className="hidden sm:inline-flex">
          <a href={CTA_WA}>Prenota consulenza</a>
        </Button>
      </div>
    </header>
  );
}

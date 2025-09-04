import Hero from "@/components/sections/Hero";
import Metodo from "@/components/sections/Metodo";
import PerChi from "@/components/sections/PerChi";
import Storia from "@/components/sections/Storia";
import Faq from "@/components/sections/Faq";
import Contact from "@/components/sections/Contact";

export default function Page() {
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8">
      <Hero />
      <Metodo />
      <PerChi />
      <Storia />
      <Faq />
      <Contact />
    </main>
  );
}

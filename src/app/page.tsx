import Hero from "@/components/sections/Hero";
import Metodo from "@/components/sections/Metodo";
import PerChi from "@/components/sections/PerChi";
import Storia from "@/components/sections/Storia";
import Faq from "@/components/sections/Faq";
import Contact from "@/components/sections/Contact";
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

export default function Page() {
  return (
    <main className="relative">
      <SideMarquees
        left={leftImgs}
        right={rightImgs}
        width={240}
        gap={12}
        speedSec={22}
      />

      <div className="max-w-6xl mx-auto px-8 md:px-8 lg:px-24 xl:px-18">
        <Hero />
        <Metodo />
        <PerChi />
        <Storia />
        <Faq />
        <Contact />
      </div>
    </main>
  );
}

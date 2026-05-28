import Image from 'next/image'

export default function LeadHero() {
  return (
    <section className="relative w-full min-h-[100vh] flex flex-col text-white overflow-hidden">
      <Image
        src="/lead-magnet/hero.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center z-0"
      />
      <div className="absolute inset-0 bg-black/30 z-10" />

      <div className="relative z-20 flex flex-col h-full min-h-[100vh] px-6 md:px-12">
        <div className="flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full pb-12">
          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight">
            <span className="block">Non siamo qui</span>
            <span className="block">per correre.</span>
            <span className="block text-right mt-2">Siamo qui per</span>
            <span className="block text-right">rinascere.</span>
          </h1>

          <div className="mt-12 flex justify-center">
            <a
              href="#form"
              className="inline-block bg-white text-neutral-900 font-bold uppercase tracking-widest text-xs px-6 py-3 rounded-full hover:bg-neutral-100 transition"
            >
              Inizia il tuo viaggio gratuito
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

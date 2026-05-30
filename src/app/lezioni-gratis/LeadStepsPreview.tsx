import Image from 'next/image'

// Static, brand-designed teaser thumbnails. They are intentionally NOT
// playable: the videos themselves unlock only after the visitor leaves an
// email and follows the magic link into the lead dashboard — that gate is
// the whole point of the lead magnet.
const THUMBNAILS = [
  { src: '/lead-magnet/thumbnail-1.jpg', alt: 'Primo video del Rituale della Leggerezza' },
  { src: '/lead-magnet/thumbnail-2.jpg', alt: 'Secondo video del Rituale della Leggerezza' },
  { src: '/lead-magnet/thumbnail-3.jpg', alt: 'Terzo video del Rituale della Leggerezza' },
]

export default function LeadStepsPreview() {
  return (
    <section className="bg-[var(--bg)] py-20 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-[var(--secondary)]">
          Tre passi verso il benessere
        </h2>
        <p className="mt-6 text-base text-neutral-700 max-w-2xl mx-auto">
          Tre video da 5-6 minuti <strong>adatti a tutte</strong>, per iniziare un passo alla volta,{' '}
          <strong>a stare bene</strong>.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {THUMBNAILS.map((t) => (
            <div
              key={t.src}
              className="relative aspect-video rounded-lg overflow-hidden border-2 border-[var(--secondary)]/30 bg-neutral-200"
            >
              <Image
                src={t.src}
                alt={t.alt}
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

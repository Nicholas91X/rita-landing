type Testimonial = {
  quote: string
  name: string
  bolds: string[]
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'A 48 anni, ho notato cambiamenti nel mio corpo, con una pancia gonfia che diventava un incubo. Dopo vari tentativi senza successo, ho scoperto Fit & Smile. Rita ti accoglie senza giudizio e con comprensione. Il suo metodo è stato efficace, restituendomi leggerezza fisica e mentale, facendomi sentire finalmente nel posto giusto.',
    name: 'Federica B.',
    bolds: ['Rita', 'senza giudizio', 'comprensione', 'nel posto giusto'],
  },
  {
    quote:
      'Ero scettica riguardo a Fit & Smile, pensando fosse ginnastica pesante. Invece, il metodo di Rita rispetta il corpo delle donne. Le sue routine serali sono diventate una coccola; ora, mi sveglio al mattino sgonfia, leggera e con una bella energia.',
    name: 'Asia R.',
    bolds: ['Rita rispetta il corpo delle donne', 'sgonfia, leggera', 'energia'],
  },
  {
    quote:
      'La sensazione di pesantezza mi opprimeva da mesi, rendendomi a disagio con i vestiti. Entrare in Fit & Smile è stata la mia salvezza. Non è un semplice corso per dimagrire, ma un percorso profondo. Il metodo di Rita lavora sul metabolismo e sullo stress in modo scientifico, senza esaurirti o imporre restrizioni. Grazie a lei, ho ritrovato armonia e ho fatto pace con lo specchio.',
    name: 'Teresa B.',
    bolds: [
      'percorso profondo',
      'Rita',
      'metabolismo',
      'stress',
      'fatto pace con lo specchio',
    ],
  },
]

function applyBold(
  text: string,
  bolds: string[],
): Array<string | { bold: string }> {
  const parts: Array<string | { bold: string }> = []
  let cursor = 0
  bolds.forEach((b) => {
    const idx = text.indexOf(b, cursor)
    if (idx === -1) return
    if (idx > cursor) parts.push(text.slice(cursor, idx))
    parts.push({ bold: b })
    cursor = idx + b.length
  })
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

export default function LeadTestimonials() {
  return (
    <section className="bg-[var(--bg)] py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-[var(--secondary)] mb-12 text-center md:text-left">
          Cosa dicono le donne in <strong>menopausa</strong> che hanno provato{' '}
          <em
            style={{ fontFamily: 'var(--font-caveat)', fontStyle: 'italic' }}
          >
            Fit&amp;Smile
          </em>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t) => (
            <article key={t.name} className="text-neutral-800">
              <p className="text-sm leading-relaxed italic">
                &ldquo;
                {applyBold(t.quote, t.bolds).map((part, i) =>
                  typeof part === 'string' ? (
                    <span key={i}>{part}</span>
                  ) : (
                    <strong key={i}>{part.bold}</strong>
                  ),
                )}
                &rdquo;
              </p>
              <p className="mt-4 text-[var(--brand)] font-bold text-sm">
                {t.name}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

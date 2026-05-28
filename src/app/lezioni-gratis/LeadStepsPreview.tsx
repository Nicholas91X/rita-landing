import Image from 'next/image'
import { getLeadPackagePreview } from '@/app/actions/lead'

export default async function LeadStepsPreview() {
  const videos = await getLeadPackagePreview()

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
          {videos.length > 0
            ? videos.map((v) => (
                <div
                  key={v.id}
                  className="relative aspect-video rounded-lg overflow-hidden border-2 border-[var(--secondary)]/30 bg-neutral-200"
                >
                  {v.bunny_video_id && (
                    <Image
                      src={`/api/bunny-thumbnail/${v.bunny_video_id}`}
                      alt={v.title ?? ''}
                      fill
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="object-cover"
                    />
                  )}
                </div>
              ))
            : Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="relative aspect-video rounded-lg bg-neutral-200 border-2 border-[var(--secondary)]/30"
                />
              ))}
        </div>
      </div>
    </section>
  )
}

// src/app/offline/page.tsx
import Image from "next/image"

export const dynamic = "force-static"

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-[#001F3D] text-white flex flex-col items-center justify-center p-8 text-center">
      <Image src="/logo/logo.png" alt="Rita" width={120} height={120} priority />
      <h1 className="mt-8 text-2xl font-black italic uppercase tracking-tighter">
        Sei offline
      </h1>
      <p className="mt-4 max-w-sm text-sm text-neutral-300 font-medium leading-relaxed">
        Riconnettiti a internet per continuare il tuo allenamento. I pacchetti
        già visti restano accessibili nella schermata principale.
      </p>
      <a
        href="/dashboard"
        className="mt-8 px-8 py-4 rounded-2xl bg-brand text-white font-black uppercase tracking-widest text-sm"
      >
        Torna alla home
      </a>
    </main>
  )
}

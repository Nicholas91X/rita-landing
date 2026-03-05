import { Button } from '@/components/ui/button'
import Logo from '@/components/Logo'
import Link from 'next/link'

export default function NotFound() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--bg)] text-center">
            <Logo variant="circle" height={64} showText={false} />
            <h1 className="text-6xl font-black text-[var(--brand)] mt-8 mb-2">404</h1>
            <h2 className="text-2xl font-bold text-[var(--foreground)] mb-3">
                Pagina non trovata
            </h2>
            <p className="text-[var(--foreground)]/60 mb-8 max-w-md">
                La pagina che stai cercando non esiste o è stata spostata.
            </p>
            <Button asChild className="bg-[var(--brand)] text-white hover:opacity-90 rounded-xl px-8 py-3 font-semibold">
                <Link href="/">Torna alla Home</Link>
            </Button>
        </main>
    )
}

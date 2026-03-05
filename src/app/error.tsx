'use client'

import { Button } from '@/components/ui/button'
import Logo from '@/components/Logo'

export default function Error({
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--bg)] text-center">
            <Logo variant="circle" height={64} showText={false} />
            <h1 className="text-3xl font-bold text-[var(--foreground)] mt-8 mb-3">
                Qualcosa è andato storto
            </h1>
            <p className="text-[var(--foreground)]/60 mb-8 max-w-md">
                Si è verificato un errore imprevisto. Riprova o torna alla pagina principale.
            </p>
            <div className="flex gap-4">
                <Button
                    onClick={reset}
                    className="bg-[var(--brand)] text-white hover:opacity-90 rounded-xl px-6 py-3 font-semibold"
                >
                    Riprova
                </Button>
                <Button
                    onClick={() => window.location.href = '/'}
                    variant="outline"
                    className="rounded-xl px-6 py-3 font-semibold border-[var(--foreground)]/20"
                >
                    Torna alla Home
                </Button>
            </div>
        </main>
    )
}

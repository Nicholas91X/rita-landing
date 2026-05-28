'use client'

import { useEffect, useState } from 'react'
import { Sparkles, AlertTriangle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LeadCountdownBannerProps {
    leadExpiresAt: string | null
    onUpgradeClick: () => void
}

export default function LeadCountdownBanner({
    leadExpiresAt,
    onUpgradeClick,
}: LeadCountdownBannerProps) {
    // Re-render every minute so the copy stays fresh; cheap.
    const [, setTick] = useState(0)
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 60_000)
        return () => clearInterval(id)
    }, [])

    const expiry = leadExpiresAt ? new Date(leadExpiresAt) : null
    const now = new Date()
    const expired = expiry ? expiry.getTime() < now.getTime() : false
    const msLeft = expiry ? expiry.getTime() - now.getTime() : 0
    const daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000))

    let copy: string
    let Icon = Sparkles
    let tone: 'safe' | 'warn' | 'expired'

    if (expired || !expiry) {
        copy = 'Il tuo accesso a Lezioni Gratis è scaduto. Completa la registrazione per riprenderlo.'
        Icon = AlertTriangle
        tone = 'expired'
    } else if (daysLeft <= 3) {
        copy = `Ti restano ${daysLeft} ${daysLeft === 1 ? 'giorno' : 'giorni'}: imposta una password per non perdere l'accesso ai video.`
        Icon = Clock
        tone = 'warn'
    } else {
        copy = `Hai ${daysLeft} giorni rimanenti. Completa la registrazione per conservare l'accesso e sbloccare tutto Fit&Smile.`
        Icon = Sparkles
        tone = 'safe'
    }

    const toneClasses: Record<typeof tone, string> = {
        safe: 'bg-[var(--brand)]/10 border-[var(--brand)]/30 text-[var(--secondary)]',
        warn: 'bg-orange-50 border-orange-300 text-orange-900',
        expired: 'bg-red-50 border-red-300 text-red-900',
    }

    const ctaClasses: Record<typeof tone, string> = {
        safe: 'bg-[var(--brand)] text-white hover:opacity-90',
        warn: 'bg-orange-600 text-white hover:bg-orange-700',
        expired: 'bg-red-600 text-white hover:bg-red-700',
    }

    return (
        <div className={cn('sticky top-0 z-20 border-b py-3 px-4 md:px-6', toneClasses[tone])}>
            <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
                <div className="flex items-center gap-3 min-w-0">
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <p className="text-sm font-medium truncate md:whitespace-normal">{copy}</p>
                </div>
                <button
                    type="button"
                    onClick={onUpgradeClick}
                    className={cn(
                        'whitespace-nowrap text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full transition',
                        ctaClasses[tone],
                    )}
                >
                    Completa profilo →
                </button>
            </div>
        </div>
    )
}

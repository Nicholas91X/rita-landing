'use client'

import { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
    interface WindowEventMap {
        beforeinstallprompt: BeforeInstallPromptEvent
    }
}

export default function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [showBanner, setShowBanner] = useState(false)
    const [isInstalled, setIsInstalled] = useState(false)

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true)
            return
        }

        // Check if user dismissed before (localStorage)
        const dismissed = localStorage.getItem('pwa-install-dismissed')
        if (dismissed) {
            const dismissedAt = new Date(dismissed)
            const daysSinceDismissed = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24)
            // Show again after 7 days
            if (daysSinceDismissed < 7) return
        }

        const handler = (e: BeforeInstallPromptEvent) => {
            e.preventDefault()
            setDeferredPrompt(e)
            setShowBanner(true)
        }

        window.addEventListener('beforeinstallprompt', handler)

        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const handleInstall = async () => {
        if (!deferredPrompt) return

        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice

        if (outcome === 'accepted') {
            setShowBanner(false)
            setIsInstalled(true)
        }
        setDeferredPrompt(null)
    }

    const handleDismiss = () => {
        setShowBanner(false)
        localStorage.setItem('pwa-install-dismissed', new Date().toISOString())
    }

    if (isInstalled || !showBanner) return null

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-50 animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-br from-[#593e25] to-[#3d2a1a] rounded-2xl p-5 shadow-2xl border border-white/10">
                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors"
                    aria-label="Chiudi"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-4">
                    <div className="p-3 bg-white/10 rounded-xl shrink-0">
                        <Smartphone className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-base mb-1">
                            Installa Rita Workout
                        </h3>
                        <p className="text-white/70 text-xs leading-relaxed mb-4">
                            Aggiungi l&apos;app alla tua home per un accesso più rapido ai tuoi allenamenti.
                        </p>
                        <Button
                            onClick={handleInstall}
                            className="w-full bg-white hover:bg-white/90 text-[#593e25] font-bold h-11 rounded-xl shadow-lg gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Installa App
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

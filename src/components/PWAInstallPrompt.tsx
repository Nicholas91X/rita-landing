'use client'

import { useState, useEffect } from 'react'
import { Download, X, Smartphone, Share, MoreVertical, Menu } from 'lucide-react'
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

type Platform = 'ios' | 'android-chrome' | 'android-samsung' | 'android-other' | 'desktop' | 'unknown'

function detectPlatform(): Platform {
    if (typeof window === 'undefined') return 'unknown'

    const ua = navigator.userAgent.toLowerCase()

    // iOS detection
    if (/iphone|ipad|ipod/.test(ua)) {
        return 'ios'
    }

    // Android detection
    if (/android/.test(ua)) {
        if (/samsungbrowser/.test(ua)) {
            return 'android-samsung'
        }
        if (/chrome/.test(ua) && !/edg/.test(ua)) {
            return 'android-chrome'
        }
        return 'android-other'
    }

    // Desktop
    if (/windows|macintosh|linux/.test(ua) && !/mobile/.test(ua)) {
        return 'desktop'
    }

    return 'unknown'
}

function getInstallInstructions(platform: Platform): { icon: React.ReactNode; steps: string[] } {
    switch (platform) {
        case 'ios':
            return {
                icon: <Share className="w-5 h-5" />,
                steps: [
                    'Tocca il pulsante Condividi in basso',
                    'Scorri e seleziona "Aggiungi a Home"',
                    'Conferma toccando "Aggiungi"'
                ]
            }
        case 'android-samsung':
            return {
                icon: <Menu className="w-5 h-5" />,
                steps: [
                    'Tocca il menu ☰ in basso a destra',
                    'Seleziona "Aggiungi pagina a"',
                    'Scegli "Schermata Home"'
                ]
            }
        case 'android-chrome':
            return {
                icon: <MoreVertical className="w-5 h-5" />,
                steps: [
                    'Tocca i tre puntini ⋮ in alto a destra',
                    'Seleziona "Aggiungi a schermata Home"',
                    'Conferma toccando "Aggiungi"'
                ]
            }
        case 'android-other':
            return {
                icon: <MoreVertical className="w-5 h-5" />,
                steps: [
                    'Apri il menu del browser',
                    'Cerca "Aggiungi a Home" o simile',
                    'Conferma l\'installazione'
                ]
            }
        case 'desktop':
            return {
                icon: <Download className="w-5 h-5" />,
                steps: [
                    'Clicca l\'icona di installazione nella barra degli indirizzi',
                    'Oppure usa il menu del browser',
                    'Seleziona "Installa app"'
                ]
            }
        default:
            return {
                icon: <Download className="w-5 h-5" />,
                steps: [
                    'Apri il menu del browser',
                    'Cerca l\'opzione per installare l\'app',
                    'Segui le istruzioni'
                ]
            }
    }
}

export default function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [showBanner, setShowBanner] = useState(false)
    const [isInstalled, setIsInstalled] = useState(false)
    const [platform, setPlatform] = useState<Platform>('unknown')
    const [showInstructions, setShowInstructions] = useState(false)

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true)
            return
        }

        // Detect platform
        const detectedPlatform = detectPlatform()
        setPlatform(detectedPlatform)

        // Check if user dismissed before (localStorage)
        const dismissed = localStorage.getItem('pwa-install-dismissed')
        if (dismissed) {
            const dismissedAt = new Date(dismissed)
            const daysSinceDismissed = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24)
            // Show again after 3 days (reduced from 7)
            if (daysSinceDismissed < 3) return
        }

        // Show banner after a short delay for better UX
        const timer = setTimeout(() => {
            setShowBanner(true)
        }, 2000)

        const handler = (e: BeforeInstallPromptEvent) => {
            e.preventDefault()
            setDeferredPrompt(e)
        }

        window.addEventListener('beforeinstallprompt', handler)

        return () => {
            window.removeEventListener('beforeinstallprompt', handler)
            clearTimeout(timer)
        }
    }, [])

    const handleInstall = async () => {
        // If native prompt is available, use it
        if (deferredPrompt) {
            await deferredPrompt.prompt()
            const { outcome } = await deferredPrompt.userChoice

            if (outcome === 'accepted') {
                setShowBanner(false)
                setIsInstalled(true)
            }
            setDeferredPrompt(null)
        } else {
            // Show manual instructions
            setShowInstructions(true)
        }
    }

    const handleDismiss = () => {
        setShowBanner(false)
        setShowInstructions(false)
        localStorage.setItem('pwa-install-dismissed', new Date().toISOString())
    }

    if (isInstalled || !showBanner) return null

    const instructions = getInstallInstructions(platform)

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

                {!showInstructions ? (
                    // Initial prompt
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
                ) : (
                    // Manual instructions
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg">
                                {instructions.icon}
                            </div>
                            <h3 className="text-white font-bold text-base">
                                Come installare
                            </h3>
                        </div>

                        <ol className="space-y-2">
                            {instructions.steps.map((step, index) => (
                                <li key={index} className="flex gap-3 text-white/90 text-sm">
                                    <span className="shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">
                                        {index + 1}
                                    </span>
                                    <span className="pt-0.5">{step}</span>
                                </li>
                            ))}
                        </ol>

                        <Button
                            onClick={handleDismiss}
                            variant="outline"
                            className="w-full bg-transparent border-white/30 text-white hover:bg-white/10 h-10 rounded-xl"
                        >
                            Ho capito
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

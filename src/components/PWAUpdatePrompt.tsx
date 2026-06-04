'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

/**
 * Shows a one-shot "new version available" toast after a real deploy.
 * Armed only if a SW already controls the page (skips first install).
 * Triggered by `controllerchange`, which only fires when a new SW takes
 * control — i.e. only after an actual deploy. A per-session guard prevents
 * repeats/loops. The user reloads on their terms (no forced reload → no
 * interrupted video).
 */
export default function PWAUpdatePrompt() {
    useEffect(() => {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
        // Skip the very first install (no controller yet = not an update).
        if (!navigator.serviceWorker.controller) return

        let shown = false
        const onChange = () => {
            if (shown) return
            shown = true
            toast('È disponibile una nuova versione', {
                description: 'Aggiorna per usare le novità.',
                duration: Infinity,
                action: { label: 'Aggiorna', onClick: () => window.location.reload() },
            })
        }
        navigator.serviceWorker.addEventListener('controllerchange', onChange)
        return () => navigator.serviceWorker.removeEventListener('controllerchange', onChange)
    }, [])

    return null
}

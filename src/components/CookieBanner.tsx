'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'cookie_ack_v1'

/**
 * Minimal ePrivacy info banner. The site only uses technical/session cookies
 * (no profiling), so this is an informational acknowledgement, not a
 * granular consent manager. The ack is stored in localStorage.
 */
export default function CookieBanner() {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        try {
            if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
        } catch {
            // localStorage unavailable (private mode) → show once, can't persist.
            setVisible(true)
        }
    }, [])

    const accept = () => {
        try {
            localStorage.setItem(STORAGE_KEY, new Date().toISOString())
        } catch {
            /* ignore */
        }
        setVisible(false)
    }

    if (!visible) return null

    return (
        <div
            role="dialog"
            aria-label="Informativa cookie"
            className="fixed inset-x-0 bottom-0 z-[200] p-4"
        >
            <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--brand)]/20 bg-[var(--panel)] shadow-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center gap-4">
                <p className="text-sm text-[var(--foreground)]/80 leading-relaxed flex-1">
                    Usiamo solo cookie tecnici necessari al funzionamento del sito (nessuna profilazione).
                    Continuando accetti il loro utilizzo. Maggiori dettagli nella{' '}
                    <Link href="/privacy" className="text-[var(--brand)] underline hover:opacity-80">
                        Privacy Policy
                    </Link>
                    .
                </p>
                <button
                    type="button"
                    onClick={accept}
                    className="shrink-0 w-full md:w-auto bg-[var(--brand)] text-white font-bold text-sm px-6 py-2.5 rounded-full hover:opacity-90 transition"
                >
                    Ho capito
                </button>
            </div>
        </div>
    )
}

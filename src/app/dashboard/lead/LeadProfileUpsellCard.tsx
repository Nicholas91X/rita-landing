'use client'

import { Lock, Award, Sparkles, BookOpen } from 'lucide-react'

interface LeadProfileUpsellCardProps {
    onUpgradeClick: () => void
}

export default function LeadProfileUpsellCard({
    onUpgradeClick,
}: LeadProfileUpsellCardProps) {
    return (
        <div className="bg-gradient-to-br from-[var(--brand)]/15 to-[var(--secondary)]/10 border border-[var(--brand)]/30 rounded-2xl p-6 md:p-8 mb-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--brand)]/20 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-[var(--brand)]" />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-[var(--dash-text)]">
                    Conserva il tuo viaggio
                </h3>
            </div>

            <p className="text-sm text-[var(--dash-muted)] mb-5">
                Stai usando un accesso ospite. Imposta una password (basta un minuto) per non perdere quello che hai costruito.
            </p>

            <ul className="space-y-3 text-sm text-[var(--dash-text)] mb-6">
                <li className="flex items-start gap-3">
                    <Sparkles className="h-4 w-4 text-[var(--brand)] flex-shrink-0 mt-0.5" />
                    <span>Mantieni i 3 video del Rituale della Leggerezza <strong>per sempre</strong></span>
                </li>
                <li className="flex items-start gap-3">
                    <BookOpen className="h-4 w-4 text-[var(--brand)] flex-shrink-0 mt-0.5" />
                    <span>Sblocca tutto il catalogo Fit&amp;Smile</span>
                </li>
                <li className="flex items-start gap-3">
                    <Award className="h-4 w-4 text-[var(--brand)] flex-shrink-0 mt-0.5" />
                    <span>Conserva il passaporto digitale e i badge guadagnati</span>
                </li>
                <li className="flex items-start gap-3">
                    <Lock className="h-4 w-4 text-[var(--brand)] flex-shrink-0 mt-0.5" />
                    <span>Accedi da qualsiasi dispositivo con email + password</span>
                </li>
            </ul>

            <button
                type="button"
                onClick={onUpgradeClick}
                className="w-full bg-[var(--brand)] text-white font-bold py-3 rounded-xl hover:opacity-90 transition"
            >
                Completa la registrazione
            </button>
        </div>
    )
}

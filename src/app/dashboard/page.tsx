import { getContentHierarchy } from '@/app/actions/content'
import DashboardClient from './DashboardClient'
import Section from '@/components/Section'

export default async function DashboardPage() {
    // Recupera la gerarchia dei contenuti dal server (Server Action)
    const levels = await getContentHierarchy()

    return (
        <main className="min-h-screen bg-[var(--bg)] text-[var(--foreground)]">
            <div className="bg-[var(--steel)] text-white py-16">
                <Section>
                    <h1 className="text-5xl font-bold mb-4 tracking-tight">Area Riservata</h1>
                    <p className="text-white/80 text-xl font-light">
                        Benvenuta nel tuo spazio di allenamento.
                    </p>
                </Section>
            </div>

            {/* Passa i dati al Client Component per gestire i Tab */}
            <DashboardClient levels={levels} />
        </main>
    )
}
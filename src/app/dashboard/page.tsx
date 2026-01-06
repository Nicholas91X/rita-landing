import { getContentHierarchy } from '@/app/actions/content'
import DashboardClient from './DashboardClient'
import Section from '@/components/Section'

export default async function DashboardPage() {
    // Recupera la gerarchia dei contenuti dal server (Server Action)
    const levels = await getContentHierarchy()

    return (
        <main className="min-h-screen bg-[var(--secondary)]">
            {/* Passa i dati al Client Component per gestire i Tab */}
            <DashboardClient levels={levels} />
        </main>
    )
}
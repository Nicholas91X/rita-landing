import type { Metadata } from 'next'
import LeadHero from './LeadHero'
import LeadStepsPreview from './LeadStepsPreview'
import LeadCaptureForm from './LeadCaptureForm'
import LeadTestimonials from './LeadTestimonials'

export const metadata: Metadata = {
  title: 'Inizia gratis con il Rituale della Leggerezza | Fit&Smile',
  description:
    '3 video gratuiti da 5-6 minuti per ritrovare equilibrio e leggerezza. Lascia la tua email, ricevi il magic link e inizia subito.',
}

export default function LezioniGratisPage() {
  return (
    <main className="bg-[var(--bg)]">
      <LeadHero />
      <LeadStepsPreview />
      <LeadCaptureForm />
      <LeadTestimonials />
    </main>
  )
}

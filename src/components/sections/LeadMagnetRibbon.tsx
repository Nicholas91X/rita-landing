import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function LeadMagnetRibbon() {
  return (
    <Link
      href="/lezioni-gratis"
      className="block bg-[var(--brand)] text-white py-3 px-6 text-center hover:opacity-95 transition"
    >
      <span className="text-sm md:text-base font-semibold inline-flex items-center gap-2">
        Inizia gratis con il Rituale della Leggerezza
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  )
}

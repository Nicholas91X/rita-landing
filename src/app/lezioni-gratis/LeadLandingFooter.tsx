import Link from 'next/link'

export default function LeadLandingFooter() {
  return (
    <footer className="bg-[var(--secondary)] text-white py-10 px-6 text-center text-xs">
      <p>© {new Date().getFullYear()} Fit&amp;Smile — Rita Zanicchi</p>
      <p className="mt-2 space-x-4">
        <Link href="/privacy" className="hover:underline">
          Privacy Policy
        </Link>
        <Link href="/terms" className="hover:underline">
          Termini
        </Link>
      </p>
    </footer>
  )
}

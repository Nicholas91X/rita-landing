"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { confirmAccountDeletion } from "@/app/actions/gdpr"
import { toast } from "sonner"

function ConfirmDeletionClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [pending, setPending] = useState(false)

  const onConfirm = async () => {
    if (!token) {
      toast.error("Token mancante")
      return
    }
    setPending(true)
    const result = await confirmAccountDeletion(token)
    setPending(false)
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    toast.success("Account cancellato. Arrivederci.")
    router.push("/")
  }

  if (!token) {
    return (
      <main className="max-w-md mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Link non valido</h1>
        <p>Il link di conferma è incompleto. Richiedi una nuova cancellazione dal tuo profilo.</p>
      </main>
    )
  }

  return (
    <main className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Conferma cancellazione account</h1>
      <p className="mb-6">
        Stai per cancellare il tuo account in modo definitivo. Verranno eliminati:
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-1">
        <li>Il tuo profilo e tutte le preferenze</li>
        <li>I tuoi acquisti e abbonamenti (gli abbonamenti attivi verranno disdetti)</li>
        <li>Il tuo progresso sui video</li>
        <li>Le notifiche e i badge</li>
      </ul>
      <p className="mb-6 text-sm text-gray-600">
        Per obbligo legale fiscale, i dati delle transazioni (pagamenti, fatture) verranno conservati per 10 anni
        in forma anonima, senza collegamento alla tua identità.
      </p>
      <p className="mb-6 font-semibold">L&apos;operazione è irreversibile.</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={pending}
          className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Cancellazione in corso..." : "Conferma cancellazione"}
        </button>
        <button
          onClick={() => router.push("/dashboard")}
          className="flex-1 border border-gray-300 py-2 rounded hover:bg-gray-100"
        >
          Annulla
        </button>
      </div>
    </main>
  )
}

export default function ConfirmDeletionPage() {
  return (
    <Suspense fallback={<main className="max-w-md mx-auto p-8 text-center">Caricamento...</main>}>
      <ConfirmDeletionClient />
    </Suspense>
  )
}

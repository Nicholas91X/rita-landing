// src/components/auth/EmailVerificationBanner.tsx
"use client"
import { useEffect, useState, useRef } from "react"
import { X, Mail } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"

const DISMISSED_KEY = "email-verify-dismissed-at"
const COOLDOWN_MS = 24 * 60 * 60 * 1000
const POLL_MS = 30_000

export function EmailVerificationBanner() {
  const [visible, setVisible] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const supabase = createClient()
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setVisible(false)
        return
      }
      if (user.email_confirmed_at) {
        setVisible(false)
        if (pollTimer.current) {
          clearInterval(pollTimer.current)
          pollTimer.current = null
        }
        return
      }
      setEmail(user.email ?? null)
      const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) ?? "0")
      const stillCooling = Number.isFinite(dismissedAt) && Date.now() - dismissedAt < COOLDOWN_MS
      setVisible(!stillCooling)
    }

    check()
    pollTimer.current = setInterval(check, POLL_MS)

    return () => {
      cancelled = true
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [supabase])

  const resend = async () => {
    if (!email || sending) return
    setSending(true)
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email })
      if (error) {
        if (/rate/i.test(error.message) || error.status === 429) {
          toast.error("Email già inviata, aspetta un minuto")
        } else {
          toast.error("Errore durante l'invio, riprova")
        }
      } else {
        toast.success("Email inviata, controlla la casella (anche spam)")
      }
    } finally {
      setSending(false)
    }
  }

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch { /* ignore */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="w-full bg-orange-500/10 border-b border-orange-500/30 text-orange-100 px-4 py-3 flex items-center gap-3 text-sm font-medium">
      <Mail className="h-4 w-4 shrink-0 text-orange-400" />
      <span className="flex-1">
        Conferma la tua email per ricevere aggiornamenti importanti e non perdere l&apos;accesso.
      </span>
      <button
        onClick={resend}
        disabled={sending}
        className="px-3 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 font-bold uppercase tracking-widest text-xs disabled:opacity-50"
      >
        {sending ? "Invio..." : "Rinvia email"}
      </button>
      <button
        onClick={dismiss}
        aria-label="Chiudi"
        className="p-1 rounded-lg hover:bg-orange-500/20"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

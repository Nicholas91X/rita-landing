// src/hooks/usePushPromptOrchestrator.ts
"use client"
import { useEffect, useState } from "react"
import { isIosSafari, isPushSupported, isStandalone, subscribeIfMissing } from "@/lib/push/client"

const VISIT_COUNT_KEY = "dashboard_visit_count"
const DISMISSED_AT_KEY = "push_prompt_dismissed_at"
const COOLDOWN_MS = 7 * 24 * 3600 * 1000
const DELAY_MS = 18_000
const MIN_VISITS = 2

type Prompt = "none" | "soft" | "ios-install"

export function usePushPromptOrchestrator(enabled: boolean): {
  prompt: Prompt
  dismiss: () => void
  acceptedSoftPrompt: () => void
} {
  const [prompt, setPrompt] = useState<Prompt>("none")

  useEffect(() => {
    if (!enabled) return
    if (!isPushSupported() && !isIosSafari()) return
    try {
      const count = Number(localStorage.getItem(VISIT_COUNT_KEY) ?? "0") + 1
      localStorage.setItem(VISIT_COUNT_KEY, String(count))

      if (isPushSupported() && Notification.permission === "granted") {
        subscribeIfMissing()
        return
      }
      if (isPushSupported() && Notification.permission === "denied") return
      if (count < MIN_VISITS) return

      const dismissed = localStorage.getItem(DISMISSED_AT_KEY)
      if (dismissed) {
        const elapsed = Date.now() - Number(dismissed)
        if (Number.isFinite(elapsed) && elapsed < COOLDOWN_MS) return
      }

      const timer = setTimeout(() => {
        if (isIosSafari() && !isStandalone()) {
          setPrompt("ios-install")
        } else if (isPushSupported()) {
          setPrompt("soft")
        }
      }, DELAY_MS)
      return () => clearTimeout(timer)
    } catch {
      // localStorage quota / disabled — silently skip
    }
  }, [enabled])

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_AT_KEY, String(Date.now())) } catch { /* ignore */ }
    setPrompt("none")
  }

  const acceptedSoftPrompt = () => {
    setPrompt("none")
  }

  return { prompt, dismiss, acceptedSoftPrompt }
}

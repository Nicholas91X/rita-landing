// src/hooks/useHeartbeat.ts
"use client"
import { useEffect } from "react"

// Pings /api/heartbeat every 30s while the tab is focused. Server upserts
// `active:<userId>` in Upstash with 90s TTL; dispatch checks this before
// firing broadcast pushes to skip users currently viewing the app.
export function useHeartbeat(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    if (typeof document === "undefined") return

    let timer: ReturnType<typeof setInterval> | null = null

    const ping = async () => {
      if (document.visibilityState !== "visible") return
      try {
        await fetch("/api/heartbeat", { method: "POST" })
      } catch {
        // silent
      }
    }

    const start = () => {
      if (timer) return
      ping()
      timer = setInterval(ping, 30_000)
    }
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null }
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") start(); else stop()
    }

    onVisibility()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [enabled])
}

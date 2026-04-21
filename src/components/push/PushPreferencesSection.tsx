// src/components/push/PushPreferencesSection.tsx
"use client"
import { useEffect, useState } from "react"
import { Bell, Trash2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import {
  getMyPrefs, setBroadcastEnabled, getMyDevices, revokeMyDevice,
  type DeviceRow,
} from "@/app/actions/push"
import { requestAndSubscribe, unsubscribeCurrent, isPushSupported } from "@/lib/push/client"

export function PushPreferencesSection() {
  const [broadcastEnabled, setBroadcast] = useState(true)
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const { pushBroadcastEnabled } = await getMyPrefs()
        setBroadcast(pushBroadcastEnabled)
        setDevices(await getMyDevices())
        if (!isPushSupported()) setPermission("unsupported")
        else setPermission(Notification.permission)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const toggleBroadcastPref = async (next: boolean) => {
    setBroadcast(next)
    try { await setBroadcastEnabled(next); toast.success("Preferenze aggiornate") }
    catch { setBroadcast(!next); toast.error("Errore salvando le preferenze") }
  }

  const revoke = async (id: string) => {
    try { await revokeMyDevice(id); setDevices(devices.filter((d) => d.id !== id)); toast.success("Dispositivo rimosso") }
    catch { toast.error("Errore rimuovendo il dispositivo") }
  }

  const enableHere = async () => {
    const r = await requestAndSubscribe()
    if (r.ok) { toast.success("Notifiche attivate"); setDevices(await getMyDevices()); setPermission("granted") }
    else if (r.reason === "permission-denied") { toast.info("Hai negato il permesso"); setPermission("denied") }
    else toast.error("Errore abilitando le notifiche")
  }

  const disableHere = async () => {
    await unsubscribeCurrent()
    setDevices(await getMyDevices())
    toast.success("Notifiche disattivate su questo dispositivo")
  }

  if (loading) return null

  return (
    <Card className="bg-neutral-900 border-white/10 rounded-[2rem]">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-white font-black uppercase italic tracking-tighter">
          <Bell className="h-5 w-5 text-brand" />
          Notifiche push
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {permission === "denied" && (
          <div className="flex gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              Hai bloccato le notifiche nelle impostazioni del browser.
              Per riattivarle, apri il pannello dei permessi del sito dal tuo
              browser e consenti le notifiche.
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="text-sm text-neutral-300">
            <strong className="text-white">Aggiornamenti importanti</strong>
            <div className="text-xs text-neutral-400 mt-1">
              Acquisti, abbonamenti, rimborsi. Sempre attive, legate al servizio.
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/5">
            <div className="text-sm text-neutral-300">
              <strong className="text-white">Annunci e novità</strong>
              <div className="text-xs text-neutral-400 mt-1">
                Nuovi pacchetti, eventi, contenuti esclusivi.
              </div>
            </div>
            <Switch checked={broadcastEnabled} onCheckedChange={toggleBroadcastPref} />
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-white/5">
          <div className="text-xs font-black uppercase tracking-widest text-neutral-400">
            Dispositivi attivi
          </div>
          {devices.length === 0 ? (
            <div className="text-sm text-neutral-400">Nessun dispositivo registrato.</div>
          ) : (
            <ul className="space-y-2">
              {devices.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-4 text-sm text-neutral-300 bg-white/5 rounded-xl px-4 py-3">
                  <div>
                    <div className="font-medium text-white">{d.browser} su {d.os}</div>
                    <div className="text-xs text-neutral-500">
                      Attivato il {new Date(d.created_at).toLocaleDateString("it-IT")}
                      {d.last_error && <span className="text-red-400 ml-2">· errore recente</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => revoke(d.id)} className="text-neutral-400 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pt-2 border-t border-white/5">
          {permission === "granted" ? (
            <Button variant="outline" onClick={disableHere} className="w-full rounded-xl">
              Disattiva su questo dispositivo
            </Button>
          ) : permission === "default" ? (
            <Button onClick={enableHere} className="w-full rounded-xl bg-brand hover:bg-brand/90 text-white font-black uppercase tracking-widest">
              Attiva su questo dispositivo
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
